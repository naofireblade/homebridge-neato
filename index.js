"use strict";
var inherits = require('util').inherits,
	debug = require('debug')('homebridge-neato'),
	botvac = require('node-botvac'),

	Service,
	Characteristic,
	vacuumRobotCleanService,
	vacuumRobotGoToDockService,
	vacuumRobotDockStateService,
	vacuumRobotEcoService,
	vacuumRobotScheduleService,
	vacuumRobotBatteryService,
	refresh,
	timer

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory("homebridge-neato", "NeatoVacuumRobot", NeatoVacuumRobot);
}

function NeatoVacuumRobot(log, config) {
	this.log = log;
	this.name = config['name'];
	this.serial = "1-3-3-7";
	this.email = config['email'];
	this.password = config['password'];

	// default off
	this.refresh = ('refresh' in config ? parseInt(config['refresh']) : 0);
	// must be integer and positive
	this.refresh = (typeof this.refresh !=='number' || (this.refresh%1)!==0 || this.refresh < 0) ? 0 : this.refresh;
	// minimum 60s
	this.refresh = (0 < this.refresh < 60) ? 60 : this.refresh;

	this.vacuumRobotCleanService = new Service.Switch(this.name + " Clean", "clean");
	this.vacuumRobotGoToDockService = new Service.Switch(this.name + " Go to Dock", "goToDock");
	this.vacuumRobotDockStateService = new Service.OccupancySensor(this.name + " Dock", "dockState");
	this.vacuumRobotEcoService = new Service.Switch(this.name + " Eco Mode", "eco");
	this.vacuumRobotScheduleService = new Service.Switch(this.name + " Schedule", "schedule");
	this.vacuumRobotBatteryService = new Service.BatteryService("Battery", "battery");

	this.lastUpdate = null;
	this.robot = null;
	this.getStateTimer();
}

NeatoVacuumRobot.prototype = {
	identify: function (callback) {
		this.log("Identify requested");
		callback();
	},

	getServices: function () {
		this.informationService = new Service.AccessoryInformation();
		this.informationService
		.setCharacteristic(Characteristic.Manufacturer, "Neato Robotics")
		.setCharacteristic(Characteristic.Model, this.name)
		.setCharacteristic(Characteristic.SerialNumber, this.serial);

		this.vacuumRobotCleanService.getCharacteristic(Characteristic.On).on('set', this.setClean.bind(this));
		this.vacuumRobotCleanService.getCharacteristic(Characteristic.On).on('get', this.getClean.bind(this));

		this.vacuumRobotGoToDockService.getCharacteristic(Characteristic.On).on('set', this.setGoToDock.bind(this));
		this.vacuumRobotGoToDockService.getCharacteristic(Characteristic.On).on('get', this.getGoToDock.bind(this));

		this.vacuumRobotDockStateService.getCharacteristic(Characteristic.OccupancyDetected).on('get', this.getDock.bind(this));

		this.vacuumRobotEcoService.getCharacteristic(Characteristic.On).on('set', this.setEco.bind(this));
		this.vacuumRobotEcoService.getCharacteristic(Characteristic.On).on('get', this.getEco.bind(this));

		this.vacuumRobotScheduleService.getCharacteristic(Characteristic.On).on('set', this.setSchedule.bind(this));
		this.vacuumRobotScheduleService.getCharacteristic(Characteristic.On).on('get', this.getSchedule.bind(this));

		this.vacuumRobotBatteryService.getCharacteristic(Characteristic.BatteryLevel).on('get', this.getBatteryLevel.bind(this));
		this.vacuumRobotBatteryService.getCharacteristic(Characteristic.ChargingState).on('get', this.getBatteryChargingState.bind(this));

		return [this.informationService, this.vacuumRobotCleanService, this.vacuumRobotGoToDockService, this.vacuumRobotDockStateService, this.vacuumRobotEcoService,
			this.vacuumRobotScheduleService, this.vacuumRobotBatteryService];
	},

	setClean: function (on, callback) {
		let that = this;
		this.getStateAndRobot(function (error, result) {
			if (on) {
				if (that.robot.canResume || that.robot.canStart) {
					// wait for robot to start and then disable the old timer and enable it again (with a shorter interval)
					setTimeout(function() {
						clearTimeout(that.timer);
						that.getStateTimer();
					}, 10000);

					if (that.robot.canResume) {
						debug("Resume cleaning");
						that.robot.resumeCleaning(callback);
					}
					else {
						debug("Start cleaning");
						that.robot.startCleaning(that.robot.eco, callback);
					}
				}
				else {
					debug("Already cleaning");
					callback();
				}
			}
			else {
				if (that.robot.canPause) {
					debug("Pause cleaning");
					that.robot.pauseCleaning(callback);
				}
				else {
					debug("Already stopped");
					callback();
				}
			}
		});
	},

	setGoToDock: function (on, callback) {
		let that = this;
		this.getStateAndRobot(function (error, result) {
			if (on) {
				if (that.robot.canPause) {
					debug("Pause cleaning to go to dock");
					that.robot.pauseCleaning(function (error, result) {
						setTimeout(function() {
							debug("Go to dock");
						    that.robot.sendToBase(callback);
						}, 1000);
					});
				}
				else if (that.robot.canGoToBase)
				{
					debug("Go to dock");
					that.robot.sendToBase(callback);
				}
				else {
					debug("Can't go to dock at the moment");
					callback();
				}
			} else {
				debug(that.robot);
				callback();
			}
		});
	},

	setEco: function (on, callback) {
		debug(on ? "Enable eco mode" : "Disable eco mode");
		this.robot.eco = on;
		callback();
	},

	setSchedule: function (on, callback) {
		let that = this;
		this.getStateAndRobot(function (error, result) {
			if (on) {
				debug("Enable schedule");
				that.robot.enableSchedule(callback); 
			}
			else {
				debug("Disable schedule");
				that.robot.disableSchedule(callback); 
			}
		});
	},

	getClean: function(callback) {
		let that = this;
		this.getStateAndRobot(function (error, result) {
			debug("Is cleaning: " + that.robot.canPause);
			callback(false, that.robot.canPause);
		});
	},

	getGoToDock: function(callback) {
		let that = this;
		this.getStateAndRobot(function (error, result) {
			debug("Can go to dock: " + that.robot.dockHasBeenSeen);
			callback(false, !that.robot.dockHasBeenSeen);
		});
	},

	getDock: function(callback) {
		let that = this;
		this.getStateAndRobot(function (error, result) {
			debug("Is docked: " + that.robot.isDocked);
			callback(false, that.robot.isDocked);
		});
	},

	getEco: function(callback) {
		// dont load eco here, because we cant save the eco state on the robot
		callback(false, this.robot.eco);
	},

	getSchedule: function(callback) {
		let that = this;
		this.getStateAndRobot(function (error, result) {
			debug("Schedule: " + that.robot.isScheduleEnabled);
			callback(false, that.robot.isScheduleEnabled);
		});
	},


	getBatteryLevel: function(callback) {
		let that = this;
		this.getStateAndRobot(function (error, result) {
			debug("Battery: " + that.robot.charge);
			callback(false, that.robot.charge);
		});
	},

	getBatteryChargingState: function(callback) {
		let that = this;
		this.getStateAndRobot(function (error, result) {
			debug("Is charging: " + that.robot.isCharging);
			callback(false, that.robot.isCharging);
		});
	},

	getStateAndRobot: function(callback) {
		let that = this;
		if (this.robot === null)
		{
			this.getRobot(function (error, result) {
				that.getState(callback);
			});
		}
		else {
			that.getState(callback);
		}
	},

	getState: function(callback) {
		if (this.lastUpdate !== null && new Date() - this.lastUpdate < 2000) {
			debug("Get state (cached)");
			callback();
		}
		else {
			debug("Get state (new)");
			let that = this;
			this.robot.getState(function (error, result) {
				that.lastUpdate = new Date();
				callback();
			});
		}
	},

	getStateTimer: function() {
		debug("Timer called");
		let that = this;
		this.getStateAndRobot(function (error, result) {

			// only update these values if the state is different from the current one, otherwise we might accidentally start an action
			if (that.vacuumRobotCleanService.getCharacteristic(Characteristic.On).value !== that.robot.canPause) {
				that.vacuumRobotCleanService.setCharacteristic(Characteristic.On, that.robot.canPause);
			}

			if (that.vacuumRobotGoToDockService.getCharacteristic(Characteristic.On).value !== !that.robot.dockHasBeenSeen) {
				that.vacuumRobotGoToDockService.setCharacteristic(Characteristic.On, !that.robot.dockHasBeenSeen);
			}

			if (that.vacuumRobotScheduleService.getCharacteristic(Characteristic.On).value !== that.robot.isScheduleEnabled) {
				that.vacuumRobotScheduleService.setCharacteristic(Characteristic.On, that.robot.isScheduleEnabled);
			}

			// no commands here, values can be updated without problems
			that.vacuumRobotDockStateService.setCharacteristic(Characteristic.OccupancyDetected, that.robot.isDocked);
			that.vacuumRobotBatteryService.setCharacteristic(Characteristic.BatteryLevel, that.robot.charge);
			that.vacuumRobotBatteryService.setCharacteristic(Characteristic.ChargingState, that.robot.isCharging);

			// dont update eco, because we cant write that value onto the robot and dont want it to be overwritten in our plugin

			if (that.robot.canPause) {
				debug("Short timer set: 30s");
				that.timer = setTimeout(that.getStateTimer.bind(that), 30 * 1000);			
			}
			else if (that.refresh != 0) {
				debug("Long timer set: " + that.refresh + "s");
				that.timer = setTimeout(that.getStateTimer.bind(that), that.refresh * 1000);
			}
			else {
				debug("Disabled timer");
			}
		});
	},

	getRobot: function(callback) {
		debug("Get robot");
		let client = new botvac.Client();
		let that = this;
		client.authorize(this.email, this.password, false, function (error) {
			if (error) {
				that.log(error);
				that.log.error("Can't log on to neato cloud. Please check your credentials.")
			}
			else {
				client.getRobots(function (error, robots) {
					if (error) {
						that.log(error);
						that.log.error("Successful login but can't connect to your neato robot.")
					}
					else {
						if (robots.length === 0) {
							that.log.error("Successful login but no robots associated with your account.")							
						}
						else {
							that.robot = robots[0];
							that.log("Found robot: " + that.robot.name);
							debug(that.robot);
							if (robots.length > 1){
								that.log.warn("Found more then one robot in your account. This plugin currently just supports one. First one found will be used.")							
							}
							callback();
						}
					}
				});
			}
		});
	}
}