# Lottery

### Dependencies

#### Install latest NodeJS

```bash
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get -y install build-essential
```

#### Install testrpc and truffle

```
sudo npm install -g ethereumjs-testrpc
sudo npm install -g truffle
```
### Start Running
#### Start testrpc (must start this first)
```
testrpc -a 3          # testrpc -a <num of accounts> 
```
#### Start deploying contract on a separate terminal
```
truffle compile
truffle migrate
truffle console 
```
Some commands to test out,
```
truffle(default)> web3.eth.accounts
truffle(default)> var lot = Lottery.deployed()
truffle(default)> lot.address
truffle(default)> web3.fromWei(web3.eth.getBalance(web3.eth.accounts[0]), "ether");
truffle(default)> lot.buyBet(3, {from: web3.eth.accounts[2], value: 9000000000000000000 });       # 3 in this case is the lottery number
```

### Testing
Testing files are placed in `/tests`. To run a suite of tests
```
truffle test
```
### Moving to private blockchain
Copy and paste the code in `contracts/Lottery.sol` into online compiler https://ethereum.github.io/browser-solidity/ </br>
From the compiler, copy and paste the section under 'Web3 deploy' into a file `lotCompiled.js` </br>
Place the file in the directory where you initiated your geth from
```
> loadScript("./lotCompiled.js")
Object [null null]
> eth.pendingTransactions 
[...]
> miner.start()            # wait till contract mined
Contract mined! address: 0xaaaaaaaaaabbbbbbbbbbcccccccccc 
> eth.getCode(lottery.address)
> lottery.jackpot.call()
0
> lottery.buyTicket(...)
> miner.start()
> lottery.jackpot.call()
500000000
```
#### For the second node
Copy and paste the section under 'Interface' from the online compiler into ABI </br>
Replace the address with the deployed contract's address
```
var lottery = eth.contract(ABI).at('0xaaaaaaaaaabbbbbbbbbbcccccccccc');
```
