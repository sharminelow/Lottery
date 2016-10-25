# Lottery

### Dependencies

#### Install latest NodeJS

```bash
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt-get install -y nodejs
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
truffle(default)> lot.buyBet(4, {from: web3.eth.accounts[2], value: 9000000000000000000 });       # 4 in this case is the lottery number
```

### Testing
Testing files are placed in `/tests`. To run a suite of tests
```
truffle test
```
### Moving to private blockchain
...
