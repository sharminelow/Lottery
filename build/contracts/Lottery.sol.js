var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("Lottery error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("Lottery error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("Lottery contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of Lottery: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to Lottery.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: Lottery not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "2387": {
    "abi": [
      {
        "constant": false,
        "inputs": [],
        "name": "stubEndLottery",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "bets",
        "outputs": [
          {
            "name": "addr",
            "type": "address"
          },
          {
            "name": "num",
            "type": "uint256"
          },
          {
            "name": "moneyBet",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "chosenNum",
            "type": "uint256"
          }
        ],
        "name": "buyBet",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "jackpot",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "numPlayers",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "checkPot",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      }
    ],
    "unlinked_binary": "0x6060604052600060016000505560006002600050556103a3806100226000396000f3606060405236156100565760e060020a60003504630478303d811461005b57806322af00fa1461007b57806346d60007146101195780636b31ee011461018e57806397b2f5561461019c578063a5c07e14146101aa575b610002565b34610002576101b960006000600060006000600060006101f560046101b6565b34610002576101bb60043560038054829081101561000257506000819052027fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b8101547fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85c8201547fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85d9290920154600160a060020a0391909116919083565b6101b960043560038054600181018083553492919082818380158290116103405760030281600302836000526020600020918201910161034091905b8082111561032257805473ffffffffffffffffffffffffffffffffffffffff191681556000600182018190556002820155600301610155565b34610002576101e360015481565b34610002576101e360025481565b34610002576101e36001545b90565b005b60408051600160a060020a039094168452602084019290925282820152519081900360600190f35b60408051918252519081900360200190f35b965060009550600094505b600354851015610273578660036000508681548110156100025790600052602060002090600302016000506001015414156103165760048054600181018083558281838015829011610303576000838152602090206103039181019083015b80821115610322576000815560010161025f565b6004546001549094508490811561000257049250600091505b838210156103265760048054879081101561000257906000526020600020900160005054905060036000508181548110156100025790600052602060002090600302016000506040519054600160a060020a03169084156108fc029085906000818181858888f19350505050151561033457610002565b5050506000928352506020909120018590555b60019490940193610200565b5090565b600060015550505050505050565b6001919091019061028c565b5050506000928352506040805160209384902060608201835233808352948201879052910184905260039190910201805473ffffffffffffffffffffffffffffffffffffffff19169091178155600181810193909355600201819055815401905556",
    "events": {},
    "updated_at": 1477418691293
  },
  "default": {
    "abi": [
      {
        "constant": true,
        "inputs": [],
        "name": "banker",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "round",
        "outputs": [
          {
            "name": "",
            "type": "uint8"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "lotteryDuration",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "claimRefunds",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "jackpot",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "commitDuration",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "stubChangeCommitRound",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "num",
            "type": "uint256"
          }
        ],
        "name": "stubSendNum",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "claimDuration",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "claimWinnings",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "commitStart",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "num",
            "type": "uint256"
          }
        ],
        "name": "sendCommitNumber",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "moneyBetPool",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "isCommitRoundClosed",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "lotteryStart",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "winners",
        "outputs": [
          {
            "name": "addr",
            "type": "address"
          },
          {
            "name": "ticketNum",
            "type": "uint256"
          },
          {
            "name": "commitHash",
            "type": "bytes32"
          },
          {
            "name": "moneyBet",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "chosenNum",
            "type": "uint256"
          },
          {
            "name": "hash",
            "type": "bytes32"
          }
        ],
        "name": "buyTicket",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "ticketMax",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "claimStart",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "claimers",
        "outputs": [
          {
            "name": "addr",
            "type": "address"
          },
          {
            "name": "ticketNum",
            "type": "uint256"
          },
          {
            "name": "commitHash",
            "type": "bytes32"
          },
          {
            "name": "moneyBet",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      }
    ],
    "unlinked_binary": "0x60606040526000805460a060020a60ff0219600160a060020a031990911633171681556004600181815542600255600383905590829055600555600a600655621275006007556008819055600f81905561092990819061005e90396000f3606060405236156100f05760e060020a60003504630ab9db5b81146100f5578063146ca5311461010c5780632d97902f146101245780633a45e6fd146101325780636b31ee011461021f5780636f8338111461022d5780637ad9641c1461023b5780639cab32a11461025b578063ab1a4d94146102c5578063b401faf1146102d3578063ba335eda146102f4578063c25180e314610302578063c680609914610329578063c9dee54314610337578063cd8cc8441461035a578063d65e119214610368578063df60aff2146103c6578063e3075e4e1461042a578063f04d688f14610438578063f6ca2dda14610446575b610002565b34610002576104a4600054600160a060020a031681565b34610002576104c160005460a060020a900460ff1681565b34610002576104c160055481565b6104d36000805b33600160a060020a03166000908152600a6020526040902054821015610506576040600090812033600160a060020a0316909152600a602052805483908110156100025790600052602060002090600402016000506003015433600160a060020a03166000908152600a6020526040902080549192509083908110156100025790600052602060002090600402016000508054600160a060020a03191681556000600182018190556002820181905560039190910181905560405133600160a060020a03169183156108fc02918491818181858888f19350505050151561050a57610002565b34610002576104c160085481565b34610002576104c160065481565b34610002576104d36000805460a060020a60ff02191660a060020a179055565b34610002576103466004356000805460a060020a900460ff168114801561028a57506002546005544291909103115b156102aa576000805460a060020a60ff02191660a060020a179055426003555b60005460019060a060020a900460ff16811461051657610002565b34610002576104c160075481565b6104d360008054819060029060a060020a900460ff16811461051f57610002565b34610002576104c160035481565b34610002576104d36004356000805460019060a060020a900460ff16811461071657610002565b34610002576104c1600f5481565b34610002576006546003544203115b604080519115158252519081900360200190f35b34610002576104c160025481565b34610002576104d560043560243560096020526000828152604090208054829081101561000257906000526020600020906004020160005080546001820154600283015460039390930154600160a060020a03929092169450925084565b6104d36004356024356000805460ff60a060020a90910416811480156103f157506005546002544203115b15610411576000805460a060020a60ff02191660a060020a179055426003555b6000805460a060020a900460ff16811461082a57610002565b34610002576104c160015481565b34610002576104c160045481565b34610002576104d5600435602435600a6020526000828152604090208054829081101561000257906000526020600020906004020160005080546001820154600283015460039390930154600160a060020a03929092169450925084565b60408051600160a060020a03929092168252519081900360200190f35b60408051918252519081900360200190f35b005b60408051600160a060020a039590951685526020850193909352838301919091526060830152519081900360800190f35b5050565b60019190910190610139565b50600192915050565b600092505b33600160a060020a03166000908152600960205260409020548310156107055760406000908120600854600f5433600160a060020a0316909352600960205281549092919086908110156100025790600052602060002090600402016000506003015481156100025733600160a060020a03166000908152600960205260409020805492909104909202935084908110156100025790600052602060002090600402016000508054600160a060020a03191681556000600182018190556002820181905560039190910181905560405133600160a060020a03169184156108fc02918591818181858888f19350505050151561070a57610002565b505050919090600052602060002090600402016000600b8054869081101561000257509052600484027f0175b7a638427703f0dbe7bb9bbf987a2551717b34e79f33b5b1008d1fa01db98101548254600160a060020a031916600160a060020a03919091161782557f0175b7a638427703f0dbe7bb9bbf987a2551717b34e79f33b5b1008d1fa01dba81015460018301557f0175b7a638427703f0dbe7bb9bbf987a2551717b34e79f33b5b1008d1fa01dbb81015460028301557f0175b7a638427703f0dbe7bb9bbf987a2551717b34e79f33b5b1008d1fa01dbc015460039190910155505b505050565b60019290920191610524565b60009150600b5482101561070557600c805460018101808355828183801582901161077b5760020281600202836000526020600020918201910161077b91905b80821115610826578054600160a060020a031916815560006001820155600201610756565b5050509190906000526020600020906002020160005060408051808201909152338082526020919091018690528154600160a060020a0319161781556001908101859055600d8054918201808255909250828183801582901161061f5760040281600402836000526020600020918201910161061f91905b80821115610826578054600160a060020a03191681556000600182018190556002820181905560038201556004016107f3565b5090565b600b54839060005b8181101561086a57600b8054849190839081101561000257906000526020600020906004020160005060020154141561087b57610002565b600154879081111561088357610002565b600101610832565b600b80546001810180835534985082818380158290116108bc576004028160040283600052602060002091820191016108bc91906107f3565b505050919090600052602060002090600402016000506040805160808101825233808252602082018d90529181018b90526060018990528154600160a060020a031916178155600181018a905560028101899055600301879055506008805487019055505050505050505056",
    "events": {},
    "updated_at": 1478897711947,
    "links": {},
    "address": "0x5941b442074a94d44ac12363221605172f46649c"
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "Lottery";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.Lottery = Contract;
  }
})();
