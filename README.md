# Financial Portfolio Analysis

## Setup

Add your trade `.csv` files in the data folder in the root of the project.

CSV files should be in the following format

```csv
symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time
```

Add a JSON file called `totalInvestedAmountAtEndOfYears.json`. This should have key-value pairs of the year and invested amount at the end of that year. For example:

```json
{
  "2021": 10000,
  "2022": 20000,
  "2023": 40000
}
```

Install the required packages. Run in the CLI

```sh
npm install
```

## Run the project

```
node index.js
```

If it runs successfully, you should be able to see the follwing files in the data folder:

```
allTrades.json
exitedTrades.json
holdings.json
lifetime-profits-breakdown.json
lifetime-total-profit.txt
yearly-profits-breakdown.json
yearly-symbol-profits-breakdown.json
```
