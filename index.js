const tradingStartDateString = '21 May, 2023'; // Replace with your trading start date in the same format. If no date as such, set as null or undefined like below
//const tradingStartDateString = null;

const fs = require('fs/promises');
const { csv2json } = require('json-2-csv');
const xirr = require('xirr');

const allTrades = [];
const holdings = {};
const exitedTrades = {};
const totalGains = {};
const yearlySymbolProfitBreakdown = {};
const yearlyProfitBreakdown = {};
const tradingStartDate = tradingStartDateString
  ? new Date(tradingStartDateString)
  : null;

async function parseCSVfiles() {
  const files = await fs.readdir('./data/');

  const filesData = await Promise.all(
    files
      ?.filter((filename) => filename.endsWith('csv'))
      ?.map((filename) => fs.readFile(`./data/${filename}`))
  );

  const jsonData = filesData.map((buffer) => csv2json(buffer.toString()));

  jsonData.forEach((jsonArray) => {
    if (jsonArray.length > 0) {
      // Zerodha
      if (jsonArray[0].symbol) {
        allTrades.push(...jsonArray);
      }
      // Groww
      else {
        jsonArray.forEach((growwRow) => {
          if (
            growwRow['Stock name'] &&
            growwRow['Buy date'] &&
            growwRow['Sell date']
          ) {
            let buyTrade = {
              trade_type: 'buy',
            };
            let sellTrade = {
              trade_type: 'sell',
            };
            const commonTradeData = {};

            const [bdd, bmm, byy] = growwRow['Buy date'].split('-');
            const [sdd, smm, syy] = growwRow['Sell date'].split('-');

            const buyDate = new Date(`${bmm}/${bdd}/${byy}`);
            const sellDate = new Date(`${smm}/${sdd}/${syy}`);
            timeDifference = Math.abs(buyDate.getTime() - sellDate.getTime());
            timeindays=timeDifference/(3600*24*1000)
            shortTermProfit=0
            LongTermProfit=0
           

            console.log({ buyDate, sellDate, timeindays });

            commonTradeData.symbol = growwRow['Stock name'];
            commonTradeData.quantity = growwRow['Quantity'];
            buyTrade.trade_date = buyDate.toISOString();
            sellTrade.trade_date = sellDate.toISOString();
            buyTrade.order_execution_time = buyDate.toISOString();
            sellTrade.order_execution_time = sellDate.toISOString();
            buyTrade.price = growwRow['Buy price'];
            sellTrade.price = growwRow['Sell price'];

            buyTrade = {
              ...buyTrade,
              ...commonTradeData,
            };
            sellTrade = {
              ...sellTrade,
              ...commonTradeData,
            };

            allTrades.push(buyTrade);
            allTrades.push(sellTrade);
          }
        });
      }
    }
  });

  await fs.writeFile(
    './data/allTrades.json',
    JSON.stringify(allTrades, null, 4),
    'utf-8'
  );
}

async function getExitedTrades() {
  allTrades.forEach(
    ({
      symbol,
      isin,
      trade_date,
      exchange,
      segment,
      series,
      trade_type,
      auction,
      quantity,
      price,
      trade_id,
      order_id,
      order_execution_time,
    }) => {
      if (!order_execution_time) console.log(symbol);

      order_execution_time = order_execution_time.split('\n').join('');
      if (trade_type === 'buy') {
        if (holdings[symbol]) {
          const oldHoldingData = holdings[symbol];

          const thisSymbolTrades = oldHoldingData.trades;

          for (let i = 0; i < quantity; i++) {
            thisSymbolTrades.push({
              price,
              order_execution_time: new Date(order_execution_time),
            });
          }

          holdings[symbol] = {
            quantity: thisSymbolTrades.length,
            price:
              thisSymbolTrades.reduce((a, b) => a + b.price, 0) /
              thisSymbolTrades.length,
            trades: thisSymbolTrades,
          };
        } else {
          const thisSymbolTrades = [];

          for (let i = 0; i < quantity; i++) {
            thisSymbolTrades.push({
              price,
              order_execution_time: new Date(order_execution_time),
            });
          }

          holdings[symbol] = {
            quantity,
            price:
              thisSymbolTrades.reduce((a, b) => a + b.price, 0) /
              thisSymbolTrades.length,
            trades: thisSymbolTrades,
          };
        }
      } else if (trade_type === 'sell') {
        if (holdings[symbol]) {
          const oldHoldingData = holdings[symbol];

          const thisSymbolTrades = oldHoldingData.trades;

          const oldBuyingPrices = [];

          for (let i = 0; i < quantity; i++) {
            const shifted = thisSymbolTrades.shift();
            if (shifted && shifted.price)
              oldBuyingPrices.push({
                buy: shifted.price,
                buy_order_execution_time: shifted.order_execution_time,
                sell: price,
                sell_order_execution_time: new Date(order_execution_time),
                gain: price - shifted.price,
              });
          }

          if (exitedTrades[symbol]) {
            exitedTrades[symbol].push(...oldBuyingPrices);
          } else {
            exitedTrades[symbol] = oldBuyingPrices;
          }

          if (thisSymbolTrades.length === 0) {
            delete holdings[symbol];
          } else {
            holdings[symbol] = {
              quantity: thisSymbolTrades.length,
              price:
                thisSymbolTrades.reduce((a, b) => a + b.price, 0) /
                thisSymbolTrades.length,
              trades: thisSymbolTrades,
            };
          }
        }
      }
    }
  );

  await fs.writeFile(
    './data/holdings.json',
    JSON.stringify(holdings, null, 4),
    'utf-8'
  );

  await fs.writeFile(
    './data/exitedTrades.json',
    JSON.stringify(exitedTrades, null, 4),
    'utf-8'
  );
}

async function getSymbolProfitBreakdown() {
  let totalGain = 0;
  Object.keys(exitedTrades).forEach((symbol) => {
    const symbolGain = exitedTrades[symbol].reduce(
      (sum, { gain }) => sum + gain,
      0
    );
    totalGains[symbol] = symbolGain;
    totalGain += symbolGain;
    if (timeindays<365)
  {
    shortTermProfit+= symbolGain
  }
  else{
    LongTermProfit+= symbolGain
  }

  }); 
  
  await fs.writeFile(
    './data/lifetime-profits-breakdown.json',
    JSON.stringify(totalGains, null, 4),
    'utf-8'
  );

  await fs.writeFile(
    './data/lifetime-total-profit.txt',
    `Total Gains: ${totalGain.toFixed(2)}\n`,
    'utf-8'
  );
}

async function getYearlySymbolProfitBreakdown() {
  Object.keys(exitedTrades).forEach((symbol) => {
    const breakdown = {};

    const symbolExitedTrades = exitedTrades[symbol];

    symbolExitedTrades.forEach(
      ({
        buy,
        buy_order_execution_time,
        sell,
        sell_order_execution_time,
        gain,
      }) => {
        const buyDate = new Date(buy_order_execution_time);
        const sellDate = new Date(sell_order_execution_time);
        const sellYear = sellDate.getFullYear();

        const tradeTimeInDays =
          (sellDate.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24);

        if (breakdown[sellYear]) {
          const newTradesTimeInDays = [
            ...breakdown[sellYear].tradesTimeInDays,
            tradeTimeInDays,
          ];

          breakdown[sellYear] = {
            ...breakdown[sellYear],
            gain: breakdown[sellYear].gain + gain,
            invested: breakdown[sellYear].invested + buy,
            tradesTimeInDays: newTradesTimeInDays,
            averageTradeTimeInDays:
              newTradesTimeInDays.reduce((sum, days) => sum + days, 0) /
              newTradesTimeInDays.length,
          };
        } else {
          breakdown[sellYear] = {
            gain,
            invested: buy,
            tradesTimeInDays: [tradeTimeInDays],
            averageTradeTimeInDays: tradeTimeInDays,
          };
        }
      }
    );

    Object.keys(yearlySymbolProfitBreakdown).forEach((symbol) => {
      Object.keys(yearlySymbolProfitBreakdown[symbol]).forEach((year) => {
        delete yearlySymbolProfitBreakdown[symbol][year].tradesTimeInDays;
        yearlySymbolProfitBreakdown[symbol][year].percentGain =
          (yearlySymbolProfitBreakdown[symbol][year].gain * 100) /
          yearlySymbolProfitBreakdown[symbol][year].invested;
      });
    });

    yearlySymbolProfitBreakdown[symbol] = breakdown;
  });

  await fs.writeFile(
    './data/yearly-symbol-profits-breakdown.json',
    JSON.stringify(yearlySymbolProfitBreakdown, null, 4),
    'utf-8'
  );
}

async function getYearlyProfitBreakdown() {
  Object.keys(yearlySymbolProfitBreakdown).forEach((symbol) => {
    Object.keys(yearlySymbolProfitBreakdown[symbol]).forEach((year) => {
      if (yearlyProfitBreakdown[year]) {
        yearlyProfitBreakdown[year] = {
          ...yearlyProfitBreakdown[year],
          gain:
            yearlyProfitBreakdown[year].gain +
            yearlySymbolProfitBreakdown[symbol][year].gain,
          invested:
            yearlyProfitBreakdown[year].invested +
            yearlySymbolProfitBreakdown[symbol][year].invested,
          tradeTimes: [
            ...yearlyProfitBreakdown[year].tradeTimes,
            yearlySymbolProfitBreakdown[symbol][year].averageTradeTimeInDays,
          ],
        };
      } else {
        yearlyProfitBreakdown[year] = {
          gain: yearlySymbolProfitBreakdown[symbol][year].gain,
          invested: yearlySymbolProfitBreakdown[symbol][year].invested,
          tradeTimes: [
            yearlySymbolProfitBreakdown[symbol][year].averageTradeTimeInDays,
          ],
        };
      }
    });
  });

  Object.keys(yearlyProfitBreakdown).forEach((year) => {
    yearlyProfitBreakdown[year].tradeTimes = yearlyProfitBreakdown[
      year
    ].tradeTimes.filter((days) => !isNaN(days));
    yearlyProfitBreakdown[year].percentGain =
      (yearlyProfitBreakdown[year].gain * 100) /
      yearlyProfitBreakdown[year].invested;
    yearlyProfitBreakdown[year].averageTradeTimeInDays =
      yearlyProfitBreakdown[year].tradeTimes.reduce(
        (sum, days) => sum + days,
        0
      ) / yearlyProfitBreakdown[year].tradeTimes.length;
    delete yearlyProfitBreakdown[year].tradeTimes;
  });

  await fs.writeFile(
    './data/yearly-profits-breakdown.json',
    JSON.stringify(yearlyProfitBreakdown, null, 4),
    'utf-8'
  );

  // console.table(yearlyProfitBreakdown);
}

async function getXIRR() {
  const allExitedTrades = [];
  Object.values(exitedTrades).forEach((exitedTradeArray) => {
    allExitedTrades.push(...exitedTradeArray);
  });
  // Extract relevant data for XIRR calculation
  let cashFlows = [];
  let cashflowsAfterStartingTrading = [];
  const yearlyCashflowBreakdown = {};

  allExitedTrades.forEach(
    ({ buy, sell, buy_order_execution_time, sell_order_execution_time }) => {
      const buyDate = new Date(buy_order_execution_time);
      const sellDate = new Date(sell_order_execution_time);

      const buyCashFlow = {
        when: buyDate,
        amount: -1 * buy,
      };
      const sellCashFlow = {
        when: sellDate,
        amount: sell,
      };
      cashFlows.push(buyCashFlow);
      cashFlows.push(sellCashFlow);

      if (tradingStartDateString) {
        if (buyDate >= tradingStartDate) {
          cashflowsAfterStartingTrading.push(buyCashFlow);
          cashflowsAfterStartingTrading.push(sellCashFlow);
        }
      }

      let fy = sellDate.getFullYear();

      if (sellDate.getMonth() < 3) {
        fy -= 1;
      }

      let fullFyString = `FY${fy}`;

      if (!yearlyCashflowBreakdown[fullFyString]) {
        yearlyCashflowBreakdown[fullFyString] = [];
      }

      yearlyCashflowBreakdown[fullFyString].push(buyCashFlow);
      yearlyCashflowBreakdown[fullFyString].push(sellCashFlow);
    }
  );

  console.log('Yearly Cash flow: ', yearlyCashflowBreakdown);

  cashFlows.sort((a, b) => (a.when.getTime() <= b.when.getTime() ? -1 : 1));
  if (tradingStartDateString) {
    cashflowsAfterStartingTrading.sort((a, b) =>
      a.when.getTime() <= b.when.getTime() ? -1 : 1
    );
  }

  // console.log(cashFlows);

  await fs.writeFile(
    './data/cashflows-breakdown.json',
    JSON.stringify(cashFlows, null, 4),
    'utf-8'
  );

  const trades = [
    {
      when: new Date('2023-12-15T18:30:00.000Z'),
      amount: -100,
    },
    {
      when: new Date('2024-12-15T18:30:00.000Z'),
      amount: 110,
    },
  ];

  console.log('');
  console.log('XIRR for exited trades');

  // Calculate XIRR
  const xirrValue = xirr(cashFlows);
  console.log(`XIRR (All Time): ${(100 * xirrValue).toFixed(2)}%`);

  const yearlyXIRRBreakdown = {};
  Object.keys(yearlyCashflowBreakdown).forEach((fy) => {
    const fyCashflow = yearlyCashflowBreakdown[fy];

    const fyXIRR = xirr(fyCashflow);

    yearlyXIRRBreakdown[fy] = `${(100 * fyXIRR).toFixed(2)}%`;
  });
  console.log('');
  console.log('Yearly XIRR breakdown');
  console.table(yearlyXIRRBreakdown);
  //console.log(shortTermProfit)
  //console.log(LongTermProfit)
  console.log(
    `Short term Gains is: ${(
      shortTermProfit
    )}`
  );

  console.log(
    `Long term Gains is: ${(
      LongTermProfit
    )}`
  );

  if (tradingStartDateString) {
    const xirrAfterStartingTradingValue = xirr(cashflowsAfterStartingTrading);
    console.log('');
    console.log(
      `XIRR (After Learning Trading): ${(
        100 * xirrAfterStartingTradingValue
      ).toFixed(2)}%`
    );
  }
}

async function main() {
  await parseCSVfiles();

  await getExitedTrades();

  await getSymbolProfitBreakdown();

  await getYearlySymbolProfitBreakdown();

  await getYearlyProfitBreakdown();

  getXIRR();
}

main();
