pragma solidity ^0.4.2;

contract Lottery {

  enum Rounds {
    betRound,
    commitRound,
    claimRound
  }

  struct Ticket {
    address addr;
    uint ticketNum;
    bytes32 commitHash;
    uint256 moneyBet;
  }

  // constants
  Rounds public round = Rounds.betRound;
  uint ticketMax = 4;
  uint public lotteryStart = 0;
  uint public lotteryDuration = 0;
  uint public commitDuration = 0;

  uint256 public jackpot = 0;
  uint[] public winners;
  Ticket[] public tickets;

  function buyTicket(uint chosenNum, bytes32 hash) payable
    atRound(Rounds.betRound) 
    isUniqueHash(hash)
    withinRange(chosenNum) {

    if (tickets.length == 0) {
      lotteryStart = now;
    }

    uint256 amount = msg.value;
    tickets.push(Ticket({addr: msg.sender,
                         ticketNum: chosenNum,
                         commitHash: hash,
                         moneyBet: amount }));
    jackpot += amount;

    // check if bettingRound ended
    if(isBetRoundClosed() == true) {
      round = Rounds.commitRound;   
    }
  }

  // stub method
  function isBetRoundClosed() returns (bool) {
    return false;
  }

  modifier isUniqueHash(bytes32 hash) {
    uint length = tickets.length;
    for (uint i = 0; i < length; i++) {
      if (tickets[i].commitHash == hash)
        throw;
    }
    _;
  }

  modifier atRound(Rounds _round) {
    if (round != _round) throw;
    _;
  }

  modifier withinRange(uint chosenNum) {
    if (chosenNum > ticketMax) throw;
    _;
  }


/*

   function genWinningNumber() internal returns (uint) {
    
  }

  function endLottery() internal {
    // genWinningNum
    // distributeWinnings
    // reset variables, startLottery
    // announcements
  }

  */
}