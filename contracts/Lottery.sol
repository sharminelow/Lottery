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
  uint public commitDuration = 2;
  uint public claimDuration = 10;

  // Demo
/*   Rounds public round = Rounds.betRound;
  uint ticketMax = 4;
  uint lotteryStart = now;
  uint commitStart = 0;
  uint claimStart = 0;
  uint lotteryDuration = 2 minutes;
  uint commitDuration = 2 minutes;
  uint claimDuration = 2 minutes; 
 */
  uint256 public jackpot = 0;
  mapping(address => Ticket[]) public winners;
  mapping(address => Ticket[]) public claimers;
  Ticket[] tickets;
  Commitment[] commitments;
  Ticket[] successfulTickets;
  Commitment[] successfulCommitments;

  uint256 public moneyBetPool = 0;

  event TicketPurchased(address from, uint bet);
  event TicketValidated(address from, bytes32 hash);
  event TicketRejected();
  event TicketInvalid(address from);
  event LotteryEnded();
  event AllCommitsReceived(uint num);
  event ClaimSuccess(address from, uint amt);
  event WrongRound(Rounds round);
  event RoundChanged();

  modifier isUniqueHash(bytes32 hash) {
    uint length = tickets.length;
    for (uint i = 0; i < length; i++) {
      if (tickets[i].commitHash == hash) {
        TicketRejected();
        throw;
      }
    }
    _;
  }

  modifier atRound(Rounds _round) {
    if (round != _round) {
      WrongRound(round);
      throw;
    }
    _;
  }

  modifier withinRange(uint chosenNum) {
    if (chosenNum > ticketMax) throw;
    _;
  }

  modifier timedTransitions() {
    if (round == Rounds.betRound &&
       ((now - lotteryStart) > lotteryDuration)) {
      RoundChanged();
      round = Rounds.commitRound;   
      commitStart = now;
    }

    if (round == Rounds.commitRound &&
       ((now - commitStart) > commitDuration)) {
      RoundChanged();
      round = Rounds.claimRound;
      checkCommitments();
    }
    _;
  }

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

  function getNumTickets() constant returns (uint) {
    uint len = tickets.length;
    return len;
  }

  function sendCommitNumber(uint num) 
    timedTransitions
    atRound(Rounds.commitRound) {
    bool found = false;

    for(uint t = 0; t < tickets.length; t++) {
      if(sha256(num) == tickets[t].commitHash && msg.sender == tickets[t].addr) {
        commitments.push(Commitment({addr: msg.sender, commitNum: num}));
        successfulTickets.push(tickets[t]); // for partial commitment case
        found = true;
        TicketValidated(msg.sender, tickets[t].commitHash);
        break;
      }
    }

    if (successfulTickets.length == tickets.length) {
      round = Rounds.claimRound;
      AllCommitsReceived(successfulTickets.length); // event
      checkCommitments();
    }

    if (found == false)
      TicketInvalid(msg.sender); // event
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

  function claimRefunds() payable 
    timedTransitions {
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
  
  function endLottery() internal {
    // generate winning number
    uint winningNum = genWinningNumber();
    
    // determine winners and moneyBet pool
    for(uint i = 0; i < tickets.length; i++) {
      if(tickets[i].ticketNum == winningNum) {
        winners[tickets[i].addr].push(tickets[i]);
        moneyBetPool += tickets[i].moneyBet;
      }
    }

    LotteryEnded();
  }

  // Claims all winnings for the particular user
  function claimWinnings() payable 
    atRound(Rounds.claimRound) {
    for(uint i = 0; i < winners[msg.sender].length; i++) {
      uint256 amtWon = winners[msg.sender][i].moneyBet / moneyBetPool * jackpot;
      delete winners[msg.sender][i];
      if (!msg.sender.send(amtWon)) {
        throw;
      } else {
        ClaimSuccess(msg.sender, amtWon);
      }
    }
  }

/* -----------------------------------------------
                Testing Methods
-------------------------------------------------*/

  function stubSendNum(uint num) 
    timedTransitions
    atRound(Rounds.commitRound) returns (bool) {
    return true;
  }

  function stubChangeCommitRound() {
    commitStart = now;
    round = Rounds.commitRound;
  }

  function stubChangeClaimRound() {
    round = Rounds.claimRound;
  }

  function stubCloseCommitRound() {
    round = Rounds.claimRound;
    checkCommitments();
  }

  function getCommitHash(uint num) returns (bytes32) {
    return sha256(num);
  }

  function stubEndLottery() {
    endLottery();
  }  
  
}

