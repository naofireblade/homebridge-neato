const debug = require('debug')('homebridge-neato');

let Service,
	Characteristic;

module.exports = function (_Service, _Characteristic)
{
	Service = _Service;
	Characteristic = _Characteristic;

	return NeatoVacuumRobotAccessory;
};

function NeatoVacuumRobotAccessory(robotObject, platform, boundary = undefined)
{
	this.platform = platform;
	this.boundary = boundary;
	this.log = platform.log;
	this.refresh = platform.refresh;
	this.hiddenServices = platform.hiddenServices;
	this.robot = robotObject.device;
	this.nextRoom = null;
	this.meta = robotObject.meta;

	if (typeof boundary === 'undefined')
	{
		this.name = this.robot.name;
	}
	else
	{
		// if boundary name already exists
		if (platform.boundaryNames.includes(this.boundary.name))
		{
			let lastChar = this.boundary.name.slice(-1);
			// boundary name already contains a count number
			if (!isNaN(lastChar))
			{
				// Increment existing count number
				this.boundary.name = this.boundary.name.slice(0, -1) + (parseInt(lastChar) + 1);
			}
			else
			{
				// Add a new count number
				this.boundary.name = this.boundary.name + " 2";
			}
		}
		platform.boundaryNames.push(this.boundary.name);
		this.name = this.robot.name + ' - ' + this.boundary.name;
	}

	this.vacuumRobotBatteryService = new Service.BatteryService("Battery", "battery");

	if (typeof boundary === 'undefined')
	{
		this.vacuumRobotCleanService = new Service.Switch(this.name + " Clean", "clean");
		this.vacuumRobotGoToDockService = new Service.Switch(this.name + " Go to Dock", "goToDock");
		this.vacuumRobotDockStateService = new Service.OccupancySensor(this.name + " Dock", "dockState");
		this.vacuumRobotEcoService = new Service.Switch(this.name + " Eco Mode", "eco");
		this.vacuumRobotNoGoLinesService = new Service.Switch(this.name + " NoGo Lines", "noGoLines");
		this.vacuumRobotExtraCareService = new Service.Switch(this.name + " Extra Care", "extraCare");
		this.vacuumRobotScheduleService = new Service.Switch(this.name + " Schedule", "schedule");
	}
	else
	{
		const splitName = boundary.name.split(' ');
		let serviceName = "Clean the " + boundary.name;
		if (splitName.length >= 2 && splitName[splitName.length - 2].match(/[']s$/g))
		{
			serviceName = "Clean " + boundary.name;
		}
		this.vacuumRobotCleanBoundaryService =
			new Service.Switch(serviceName, "cleanBoundary:" + boundary.id);
		this.log("Adding zone cleaning for: " + boundary.name);
	}
}

NeatoVacuumRobotAccessory.prototype = {
	identify: function (callback)
	{
		this.platform.updateRobot(this.robot._serial, () =>
		{
			// hide serial and secret in log
			let _serial = this.robot._serial;
			let _secret = this.robot._secret;
			this.robot._serial = "*****";
			this.robot._secret = "*****";
			this.log(this.robot);
			this.robot._serial = _serial;
			this.robot._secret = _secret;
			callback();
		});
	},

	getServices: function ()
	{
		this.informationService = new Service.AccessoryInformation();
		this.informationService
		.setCharacteristic(Characteristic.Manufacturer, "Neato Robotics")
		.setCharacteristic(Characteristic.Model, this.meta.modelName)
		.setCharacteristic(Characteristic.SerialNumber, this.robot._serial)
		.setCharacteristic(Characteristic.FirmwareRevision, this.meta.firmware);
		if (typeof this.boundary === "undefined")
		{
			this.informationService
			.setCharacteristic(Characteristic.Name, this.robot.name)
		}
		else
		{
			this.informationService
			.setCharacteristic(Characteristic.Name, this.robot.name + ' - ' + this.boundary.name)
		}

		this.services = [this.informationService];

		if (typeof this.boundary === "undefined")
		{
			this.vacuumRobotCleanService.getCharacteristic(Characteristic.On).on('set', (on, serviceCallback) =>
			{
				this.setClean(on, serviceCallback, this.boundary)
			});
			this.vacuumRobotCleanService.getCharacteristic(Characteristic.On).on('get', (serviceCallback) =>
			{
				this.getClean(serviceCallback, this.boundary);
			});

			this.vacuumRobotGoToDockService.getCharacteristic(Characteristic.On).on('set', this.setGoToDock.bind(this));
			this.vacuumRobotGoToDockService.getCharacteristic(Characteristic.On).on('get', this.getGoToDock.bind(this));

			this.vacuumRobotDockStateService.getCharacteristic(Characteristic.OccupancyDetected).on('get', this.getDock.bind(this));

			this.vacuumRobotEcoService.getCharacteristic(Characteristic.On).on('set', this.setEco.bind(this));
			this.vacuumRobotEcoService.getCharacteristic(Characteristic.On).on('get', this.getEco.bind(this));

			this.vacuumRobotNoGoLinesService.getCharacteristic(Characteristic.On).on('set', this.setNoGoLines.bind(this));
			this.vacuumRobotNoGoLinesService.getCharacteristic(Characteristic.On).on('get', this.getNoGoLines.bind(this));

			this.vacuumRobotExtraCareService.getCharacteristic(Characteristic.On).on('set', this.setExtraCare.bind(this));
			this.vacuumRobotExtraCareService.getCharacteristic(Characteristic.On).on('get', this.getExtraCare.bind(this));

			this.vacuumRobotScheduleService.getCharacteristic(Characteristic.On).on('set', this.setSchedule.bind(this));
			this.vacuumRobotScheduleService.getCharacteristic(Characteristic.On).on('get', this.getSchedule.bind(this));

			this.vacuumRobotBatteryService.getCharacteristic(Characteristic.BatteryLevel).on('get', this.getBatteryLevel.bind(this));
			this.vacuumRobotBatteryService.getCharacteristic(Characteristic.ChargingState).on('get', this.getBatteryChargingState.bind(this));

			this.services.push(this.vacuumRobotCleanService);
			this.services.push(this.vacuumRobotBatteryService);

			if (this.hiddenServices.indexOf('dock') === -1)
				this.services.push(this.vacuumRobotGoToDockService);
			if (this.hiddenServices.indexOf('dockstate') === -1)
				this.services.push(this.vacuumRobotDockStateService);
			if (this.hiddenServices.indexOf('eco') === -1)
				this.services.push(this.vacuumRobotEcoService);
			if (this.hiddenServices.indexOf('nogolines') === -1)
				this.services.push(this.vacuumRobotNoGoLinesService);
			if (this.hiddenServices.indexOf('extracare') === -1)
				this.services.push(this.vacuumRobotExtraCareService);
			if (this.hiddenServices.indexOf('schedule') === -1)
				this.services.push(this.vacuumRobotScheduleService);
		}
		else
		{
			this.vacuumRobotCleanBoundaryService.getCharacteristic(Characteristic.On).on('set', (on, serviceCallback) =>
			{
				this.setClean(on, serviceCallback, this.boundary)
			});
			this.vacuumRobotCleanBoundaryService.getCharacteristic(Characteristic.On).on('get', (serviceCallback) =>
			{
				this.getClean(serviceCallback, this.boundary);
			});
			this.services.push(this.vacuumRobotCleanBoundaryService);
		}

		return this.services;
	},


	getClean: function (callback, boundary)
	{
		this.platform.updateRobot(this.robot._serial, (error, result) =>
		{
			let cleaning;
			if (typeof boundary === 'undefined')
			{
				cleaning = this.robot.canPause;
			}
			else
			{
				cleaning = this.robot.canPause && (this.robot.cleaningBoundaryId === boundary.id)
			}

			debug(this.name + ": Cleaning is " + (cleaning ? 'ON' : 'OFF'));
			callback(false, cleaning);
		});
	},

	setClean: function (on, callback, boundary)
	{
		this.platform.updateRobot(this.robot._serial, (error, result) =>
		{
			// Start
			if (on)
			{
				// No room given or same room
				if (typeof boundary === 'undefined' || this.robot.cleaningBoundaryId === boundary.id)
				{
					// Resume cleaning
					if (this.robot.canResume)
					{
						debug(this.name + ": ## Resume cleaning");
						this.robot.resumeCleaning(callback);
					}
					// Start cleaning
					else if (this.robot.canStart)
					{
						this.clean(callback, boundary);
					}
					// Cannot start
					else
					{
						debug(this.name + ": Cannot start, maybe already cleaning");
						callback();
					}
				}
				// Different room given
				else
				{
					// Return to dock
					if (this.robot.canPause || this.robot.canResume)
					{
						debug(this.name + ": ## Returning to dock to start cleaning of new room");
						this.setGoToDock(true, (error, result) =>
						{
							this.nextRoom = boundary;
						});
					}
					// Start new cleaning of new room
					else
					{
						this.clean(callback, boundary);
					}
				}
			}
			// Stop
			else
			{
				if (this.robot.canPause)
				{
					debug(this.name + ": ## Pause cleaning");
					this.robot.pauseCleaning(callback);
				}
				else
				{
					debug(this.name + ": Already paused");
					callback();
				}
			}
		});
	},

	clean: function (callback, boundary)
	{
		// Start automatic update while cleaning
		if (this.refresh === 'auto')
		{
			setTimeout(() =>
			{
				this.platform.updateRobotTimer(this.robot._serial);
			}, 60 * 1000);
		}


		let eco = this.vacuumRobotEcoService.getCharacteristic(Characteristic.On).value;
		let extraCare = this.vacuumRobotExtraCareService.getCharacteristic(Characteristic.On).value;
		let nogoLines = this.vacuumRobotNoGoLinesService.getCharacteristic(Characteristic.On).value;
		let room = (typeof boundary === 'undefined') ? '' : boundary.name;
		debug(this.name + ": ## Start cleaning (" + room + " eco: " + eco + ", extraCare: " + extraCare + ", nogoLines: " + nogoLines + ")");

		// Normal cleaning
		if (typeof boundary === 'undefined')
		{
			this.robot.startCleaning(
				eco,
				extraCare ? 2 : 1,
				nogoLines,
				(error, result) =>
				{
					if (error)
					{
						this.log.error("Cannot start cleaning. " + error + ": " + JSON.stringify(result));
						callback(true);
					}
					else
					{
						callback();
					}
				});
		}
		// Room cleaning
		else
		{
			this.robot.startCleaningBoundary(eco, extraCare, boundary.id, (error, result) =>
			{
				if (error)
				{
					this.log.error("Cannot start room cleaning. " + error + ": " + JSON.stringify(result));
					callback(true);
				}
				else
				{
					callback();
				}
			});
		}
	},

	getGoToDock: function (callback)
	{
		callback(false, false);
	},

	setGoToDock: function (on, callback)
	{
		this.platform.updateRobot(this.robot._serial, (error, result) =>
		{
			if (on)
			{
				if (this.robot.canPause)
				{
					debug(this.name + ": ## Pause cleaning to go to dock");
					this.robot.pauseCleaning((error, result) =>
					{
						setTimeout(() =>
						{
							debug(this.name + ": ## Go to dock");
							this.robot.sendToBase(callback);
						}, 1000);
					});
				}
				else if (this.robot.canGoToBase)
				{
					debug(this.name + ": ## Go to dock");
					this.robot.sendToBase(callback);
				}
				else
				{
					this.log.warn(this.name + ": Can't go to dock at the moment");
					callback();
				}
			}
			else
			{
				callback();
			}
		});
	},

	getEco: function (callback)
	{
		this.platform.updateRobot(this.robot._serial, () =>
		{
			debug(this.name + ": Eco Mode is " + (this.robot.eco ? 'ON' : 'OFF'));
			callback(false, this.robot.eco);
		});
	},

	setEco: function (on, callback)
	{
		this.robot.eco = on;
		debug(this.name + ": " + (on ? "Enabled " : "Disabled") + " Eco Mode ");
		callback();
	},

	getNoGoLines: function (callback)
	{
		this.platform.updateRobot(this.robot._serial, () =>
		{
			debug(this.name + ": NoGoLine is " + (this.robot.eco ? 'ON' : 'OFF'));
			callback(false, this.robot.noGoLines ? 1 : 0);
		});
	},

	setNoGoLines: function (on, callback)
	{
		this.robot.noGoLines = on;
		debug(this.name + ": " + (on ? "Enabled " : "Disabled") + " NoGoLine ");
		callback();
	},

	getExtraCare: function (callback)
	{
		this.platform.updateRobot(this.robot._serial, () =>
		{
			debug(this.name + ": Care Nav is " + (this.robot.navigationMode === 2 ? 'ON' : 'OFF'));
			callback(false, this.robot.navigationMode === 2 ? 1 : 0);
		});
	},

	setExtraCare: function (on, callback)
	{
		this.robot.navigationMode = on ? 2 : 1;
		debug(this.name + ": " + (on ? "Enabled " : "Disabled") + " Care Nav ");
		callback();
	},

	getSchedule: function (callback)
	{
		this.platform.updateRobot(this.robot._serial,() =>
		{
			debug(this.name + ": Schedule is " + (this.robot.eco ? 'ON' : 'OFF'));
			callback(false, this.robot.isScheduleEnabled );
		});
	},

	setSchedule: function (on, callback)
	{
		this.platform.updateRobot(this.robot._serial, (error, result) =>
		{
			if (on)
			{
				debug(this.name + ": Enabled  Schedule");
				this.robot.enableSchedule(callback);
			}
			else
			{
				debug(this.name + ": Disabled Schedule");
				this.robot.disableSchedule(callback);
			}
		});
	},

	getDock: function (callback)
	{
		this.platform.updateRobot(this.robot._serial, () =>
		{
			debug(this.name + ": The Dock is " + (this.robot.isDocked ? '' : 'un ') + "occupied");
			callback(false, this.robot.isDocked ? 1 : 0);
		});
	},

	getBatteryLevel: function (callback)
	{
		this.platform.updateRobot(this.robot._serial, () =>
		{
			debug(this.name + ": Battery  is " + this.robot.charge + "%");
			callback(false, this.robot.charge);
		});
	},

	getBatteryChargingState: function (callback)
	{
		this.platform.updateRobot(this.robot._serial, () =>
		{
			debug(this.name + ": Battery  is " + (this.robot.isCharging ? '' : 'not ') + "charging");
			callback(false, this.robot.isCharging);
		});
	},

	updated: function ()
	{
		if (!this.boundary)
		{
			// only update these values if the state is different from the current one, otherwise we might accidentally start an action
			if (this.vacuumRobotCleanService.getCharacteristic(Characteristic.On).value !== this.robot.canPause)
			{
				this.vacuumRobotCleanService.setCharacteristic(Characteristic.On, this.robot.canPause);
			}

			// dock switch is on (dock not seen before) and dock has just been seen -> turn switch off
			if (this.vacuumRobotGoToDockService.getCharacteristic(Characteristic.On).value == true && this.robot.dockHasBeenSeen)
			{
				this.vacuumRobotGoToDockService.setCharacteristic(Characteristic.On, false);
			}

			if (this.vacuumRobotScheduleService.getCharacteristic(Characteristic.On).value !== this.robot.isScheduleEnabled )
			{
				this.vacuumRobotScheduleService.setCharacteristic(Characteristic.On, this.robot.isScheduleEnabled );
			}

			// no commands here, values can be updated without problems
			this.vacuumRobotDockStateService.setCharacteristic(Characteristic.OccupancyDetected, this.robot.isDocked ? 1 : 0);
			this.vacuumRobotEcoService.setCharacteristic(Characteristic.On, this.robot.eco);
			this.vacuumRobotNoGoLinesService.setCharacteristic(Characteristic.On, this.robot.noGoLines);
			this.vacuumRobotExtraCareService.setCharacteristic(Characteristic.On, this.robot.navigationMode == 2 ? true : false);

		}
		else
		{
			if (this.vacuumRobotCleanBoundaryService.getCharacteristic(Characteristic.On).value !== this.robot.canPause)
			{
				this.vacuumRobotCleanBoundaryService.setCharacteristic(Characteristic.On, this.robot.canPause);
			}
		}

		this.vacuumRobotBatteryService.setCharacteristic(Characteristic.BatteryLevel, this.robot.charge);
		this.vacuumRobotBatteryService.setCharacteristic(Characteristic.ChargingState, this.robot.isCharging);

		// Robot has a next room to clean in queue
		if (this.nextRoom !== null && this.robot.isDocked)
		{
			this.clean((error, result) =>
			{
				this.nextRoom = null;
				debug("## Starting cleaning of next room");
			}, this.nextRoom);
		}
	}
};