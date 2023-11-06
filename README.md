# Financial Portfolio Analysis

## Setup

Add your trade `.csv` files in the data folder in the root of the project.

CSV files should be in the following format

```
symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time
```

Install the required packages. Run in the CLI

```
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
