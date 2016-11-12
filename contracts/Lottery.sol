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

  struct Commitment {
    address addr;
    uint commitNum;
  }
  
  address public banker = msg.sender;

  // Testing
  Rounds public round = Rounds.betRound;
  uint public ticketMax = 4;
  uint public lotteryStart = now;
  uint public commitStart = 0;
  uint public claimStart = 0;
  uint public lotteryDuration = 1; // 1 seconds;
  uint public commitDuration = 10;
  uint public claimDuration = 10;


  // constants
/*   Rounds public round = Rounds.betRound;
  uint ticketMax = 1024;
  uint lotteryStart = now;
  uint commitStart = 0;
  uint claimStart = 0;
  uint lotteryDuration = 3 days;
  uint commitDuration = 3 days;
  uint claimDuration = 1209600; */

  uint256 public jackpot = 0;
  mapping(address => Ticket[]) public winners;
  mapping(address => Ticket[]) public claimers;
  Ticket[] tickets;
  Commitment[] commitments;
  Ticket[] successfulTickets;
  Commitment[] successfulCommitments;

  uint256 public moneyBetPool = 0;

  event TicketPurchased(address from, uint bet);
  event TicketValidated(address from);

  function buyTicket(uint chosenNum, bytes32 hash) payable
    timedTransitions
    atRound(Rounds.betRound) 
    isUniqueHash(hash)
    withinRange(chosenNum) {

    uint256 amount = msg.value;
    tickets.push(Ticket({addr: msg.sender,
                         ticketNum: chosenNum,
                         commitHash: hash,
                         moneyBet: amount }));
    jackpot += amount;
    TicketPurchased(msg.sender, amount);
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

  function sendCommitNumber(uint num) atRound(Rounds.commitRound) {
    for(uint t = 0; t < tickets.length; t++) {
      if(sha256(num ^ uint(msg.sender)) == tickets[t].commitHash && msg.sender == tickets[t].addr) {
        commitments.push(Commitment({addr: msg.sender, commitNum: num}));
        successfulTickets.push(tickets[t]); // for partial commitment case
        break;
      }
    }

    /* 
    xh: i think this part shouldnt be inside this function
    if (isCommitRoundClosed()) {
      checkCommitments();
    }
    */
  }

  modifier timedTransitions() {
    if (round == Rounds.betRound &&
       ((now - lotteryStart) > lotteryDuration)) {
      round = Rounds.commitRound;   
      commitStart = now;
    }
    _;
  }

  // Start of testing methods
  function stubSendNum(uint num) 
    timedTransitions
    atRound(Rounds.commitRound) returns (bool) {
    return true;
  }

  function stubChangeCommitRound() {
    round = Rounds.commitRound;
  }

  function stubChangeClaimRound() {
    round = Rounds.claimRound;
  }

  // xh: for my test, i didnt account for time so i went straight to check commitments instead.
  function stubCloseCommitRound() {
    checkCommitments();
  }

  // End of testing methods

  function isCommitRoundClosed() returns (bool) {
    return ((now - commitStart) > commitDuration);
  }

  function checkCommitments() internal {
    if(commitments.length == 0) {
      for(uint i = 0; i < tickets.length; i++) {
        claimers[tickets[i].addr].push(tickets[i]);
      }
    } else if(commitments.length != tickets.length) {
      for(i = 0; i < successfulTickets.length; i++) {
        claimers[successfulTickets[i].addr].push(successfulTickets[i]);
      }
    } else {
      endLottery();
    }

  }

  function claimRefunds() payable {
    for(uint i = 0; i < claimers[msg.sender].length; i++) {
      uint256 amtRefund = claimers[msg.sender][i].moneyBet;
      delete claimers[msg.sender][i];
      if (!msg.sender.send(amtRefund)) {
        throw;
      }
    }
  }

  function genWinningNumber() internal returns (uint) {
    return 0;
  /*  
    uint currentBlockNumber = block.number;
    bytes32 xorBlockHashes = 0;
    uint xorCommitmentNumber = 0;

    for(uint i = 0; i < 3; i++) {
      xorBlockHashes = xorBlockHashes ^ block.blockhash(currentBlockNumber - i);
    }

    for(uint i = 0; i < commitments.length; i++) {
      xorCommitmentNumber = xorCommitmentNumber ^ commitments[i].commitNum;
    }

    bytes32 commitmentNumberInBytes = bytes32(xorCommitmentNumber);

    bytes32 randomNumberInBytes = xorBlockHashes ^ commitmentNumberInBytes;

    bytes32 last10Bits = randomNumberInBytes & "0x3ff";

    uint winningNumber = last10Bits & "0xfff";

    return winningNumber;
  */
  }
  
  function endLottery() {
    // generate winning number
    uint winningNum = genWinningNumber();
    
    // determine winners and moneyBet pool
    for(uint i = 0; i < tickets.length; i++) {
      if(tickets[i].ticketNum == winningNum) {
        winners[tickets[i].addr].push(tickets[i]);
        moneyBetPool += tickets[i].moneyBet;
      }
    }

    // reset variables
    // startLottery
    // announcements
  }

  // Claims all winnings for the particular user
  function claimWinnings() payable 
    atRound(Rounds.claimRound) {
    for(uint i = 0; i < winners[msg.sender].length; i++) {
      uint256 amtWon = winners[msg.sender][i].moneyBet / moneyBetPool * jackpot;
      delete winners[msg.sender][i];
      if (!msg.sender.send(amtWon)) {
        throw;
      }
    }
  }
}

