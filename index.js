const fs = require('fs/promises');
const { csv2json } = require('json-2-csv');
const xirr = require('xirr');

const allTrades = [];
const holdings = {};
const exitedTrades = {};
const totalGains = {};
const yearlySymbolProfitBreakdown = {};
const yearlyProfitBreakdown = {};
const totalInvestedAmountsAtEndOfYears = require('./data/totalInvestedAmountAtEndOfYears.json');

async function parseCSVfiles() {
  const files = await fs.readdir('./data/');

  const filesData = await Promise.all(
    files
      ?.filter((filename) => filename.endsWith('csv'))
      ?.map((filename) => fs.readFile(`./data/${filename}`))
  );

  const jsonData = filesData.map((buffer) => csv2json(buffer.toString()));

  jsonData.forEach((jsonArray) => {
    allTrades.push(...jsonArray);
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
    yearlyProfitBreakdown[year].totalInvestedThatYear =
      totalInvestedAmountsAtEndOfYears[year];
    yearlyProfitBreakdown[year].gainOnInvestment =
      (yearlyProfitBreakdown[year].gain * 100) /
      yearlyProfitBreakdown[year].totalInvestedThatYear;
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
  allExitedTrades.forEach(
    ({ buy, sell, buy_order_execution_time, sell_order_execution_time }) => {
      cashFlows.push({
        when: new Date(buy_order_execution_time),
        amount: -1 * buy,
      });
      cashFlows.push({
        when: new Date(sell_order_execution_time),
        amount: sell,
      });
    }
  );

  cashFlows.sort((a, b) => (a.when.getTime() <= b.when.getTime() ? -1 : 1));

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
      when: new Date('2023-12-20T18:30:00.000Z'),
      amount: 110,
    },
  ];

  // Calculate XIRR
  const xirrValue = xirr(cashFlows);

  console.log(`XIRR on exited trades: ${(100 * xirrValue).toFixed(2)}%`);
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
