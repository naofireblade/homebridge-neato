import {CharacteristicValue, Logger, PlatformAccessory, PlatformConfig, Service} from 'homebridge';
import {HomebridgeNeatoPlatform} from '../homebridgeNeatoPlatform';

const debug = require('debug')('my-app:my-module');

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class NeatoVacuumRobotAccessory
{
	private robot: any;
	private log: Logger;
	private readonly refresh: any;
	private spotClean: boolean;

	private options: any;

	private batteryService: Service;
	private cleanService: Service;
	private findMeService: Service;
	private goToDockService: Service;
	private dockStateService: Service;
	private ecoService: Service;
	private noGoLinesService: Service;
	private extraCareService: Service;
	private scheduleService: Service;
	private spotCleanService: Service;

	/**
	 * These are just used to create a working example
	 * You should implement your own code to track the state of your accessory
	 */

	constructor(
			private readonly platform: HomebridgeNeatoPlatform,
			private readonly accessory: PlatformAccessory,
			private readonly isNew: Boolean,
			private readonly config: PlatformConfig)
	{
		this.robot = accessory.context.robot;
		this.log = platform.log;

		if ('refresh' in this.config && this.config['refresh'] !== 'auto')
		{
			// parse config parameter
			this.refresh = parseInt(this.config['refresh']);
			// must be integer and positive
			this.refresh = (typeof this.refresh !== 'number' || (this.refresh % 1) !== 0 || this.refresh < 0) ? 60 : this.refresh;
			// minimum 60s to save some load on the neato servers
			if (this.refresh > 0 && this.refresh < 60)
			{
				this.log.warn("Minimum refresh time is 60 seconds to not overload the neato servers");
				this.refresh = (this.refresh > 0 && this.refresh < 60) ? 60 : this.refresh;
			}
		}
		else
		{
			this.refresh = 'auto';
		}
		this.log.debug(this.robot.name + " ## Refresh set to: " + this.refresh);

		this.spotClean = false;
		this.options = {};

		// set accessory information
		this.accessory.getService(this.platform.Service.AccessoryInformation)!
				.setCharacteristic(this.platform.Characteristic.Manufacturer, "Neato Robotics")
				.setCharacteristic(this.platform.Characteristic.Model, this.robot.meta.modelName)
				.setCharacteristic(this.platform.Characteristic.SerialNumber, this.robot._serial)
				.setCharacteristic(this.platform.Characteristic.FirmwareRevision, this.robot.meta.firmware)
				.setCharacteristic(this.platform.Characteristic.Name, this.robot.name);

		this.batteryService = this.accessory.getService(this.platform.Service.Battery) || this.accessory.addService(this.platform.Service.Battery)

		this.cleanService = this.getSwitchService(this.robot.name + " Clean");
		this.findMeService = this.getSwitchService(this.robot.name + " Find Me");
		this.goToDockService = this.getSwitchService(this.robot.name + " Go to Dock");
		this.dockStateService = this.getOccupancyService(this.robot.name + " Docked")
		this.ecoService = this.getSwitchService(this.robot.name + " Eco Mode");
		this.noGoLinesService = this.getSwitchService(this.robot.name + " NoGo Lines");
		this.extraCareService = this.getSwitchService(this.robot.name + " Extra Care");
		this.scheduleService = this.getSwitchService(this.robot.name + " Schedule");
		this.spotCleanService = this.getSwitchService(this.robot.name + " Clean Spot");

		this.cleanService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setClean.bind(this))
				.onGet(this.getClean.bind(this));
		this.findMeService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setFindMe.bind(this))
				.onGet(this.getFindMe.bind(this));
		this.goToDockService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setGoToDock.bind(this))
				.onGet(this.getGoToDock.bind(this));
		this.dockStateService.getCharacteristic(this.platform.Characteristic.On)
				.onGet(this.getFindMe.bind(this));
		this.ecoService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setEco.bind(this))
				.onGet(this.getEco.bind(this));
		this.noGoLinesService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setFindMe.bind(this))
				.onGet(this.getFindMe.bind(this));
		this.extraCareService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setFindMe.bind(this))
				.onGet(this.getFindMe.bind(this));
		this.scheduleService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setFindMe.bind(this))
				.onGet(this.getFindMe.bind(this));
		this.spotCleanService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setSpotClean.bind(this))
				.onGet(this.getSpotClean.bind(this));
		
		this.updateRobotPeriodically().then(r => this.log.debug(this.robot.name + " ## Periodic update started with interval: " + this.refresh));
	}

	getSwitchService(servicename: string)
	{
		return this.accessory.getService(servicename) || this.accessory.addService(this.platform.Service.Switch, servicename, servicename)
	}

	getOccupancyService(servicename: string)
	{
		return this.accessory.getService(servicename) || this.accessory.addService(this.platform.Service.OccupancySensor, servicename, servicename)
	}

	async setClean(on: CharacteristicValue)
	{
		// TODO debug(this.robot.name + ": " + (on ? "Enabled ".brightGreen : "Disabled".red) + " Clean " + (this.boundary ? JSON.stringify(this.boundary) : ''));
		try
		{
			await this.updateRobot();

			// Start
			if (on)
			{
				// Resume cleaning
				if (this.robot.canResume)
				{
					debug(this.robot.name + " => Resume cleaning");
					await this.robot.resumeCleaning();
					return;
				}
				// Start cleaning
				else if (this.robot.canStart)
				{
					await this.clean(CleanType.ALL)
				}
				// Cannot start
				else
				{
					this.log.debug(this.robot.name + ": Cannot start, maybe already cleaning (expected)");
					return;
				}
			}
			// Stop
			else
			{
				if (this.robot.canPause)
				{
					this.log.debug(this.robot.name + " => Pause cleaning");
					await this.robot.pauseCleaning();
				}
				else
				{
					this.log.debug(this.robot.name + ": Already paused");
				}
			}
		}
		catch (error)
		{
			this.log.error("Error setting cleaning to: " + on + ". " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	async getClean(): Promise<CharacteristicValue>
	{
		try
		{
			await this.updateRobot();
			let on = this.robot.canPause && !this.spotClean;
			this.log.debug(this.robot.name + " ## Clean is: " + on);
			return on;
		}
		catch (error)
		{
			this.log.warn("Cannot get cleaning status: " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	async getSpotClean(): Promise<CharacteristicValue>
	{
		await this.updateRobot();
		let on = this.robot.canPause && this.spotClean;
		this.log.debug(this.robot.name + " ## Spot Clean is: " + on);
		return on;
	}

	async setSpotClean(on: CharacteristicValue)
	{
		await this.clean(CleanType.SPOT)
	}

	getGoToDock()
	{
		return false;
	}

	async setGoToDock(on: CharacteristicValue)
	{
		if (on)
		{
			await this.updateRobot();
			
			setTimeout(() => {
				this.goToDockService.updateCharacteristic(this.platform.Characteristic.On, false);
			}, 1000);

			try
			{
				if (this.robot.canPause)
				{
					this.log.debug(this.robot.name + " => Pause cleaning to go to dock");
					await this.robot.pauseCleaning();
					setTimeout(async () => {
						await this.robot.sendToBase();
					}, 1000);
				}
				else if (this.robot.canGoToBase)
				{
					this.log.debug(this.robot.name + " => Go to dock");
					await this.robot.sendToBase();
				}
				else
				{
					this.log.warn(this.robot.name + "=| Can't go to dock at the moment");
				}
			}
			catch (error)
			{
				this.log.warn("Error setting go to dock to: " + on + ". " + error);
				throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
			}
		}
	}

	getEco()
	{
		let on = this.options.eco;
		this.log.debug(this.robot.name + " ## Eco is: " + on);
		return on;
	}

	setEco(on: CharacteristicValue)
	{
		this.options.eco = on;
		this.log.debug(this.robot.name + " ## Option eco set to: " + on);
	}

	getFindMe()
	{
		return false;
	}

	async setFindMe(on: CharacteristicValue)
	{
		if (on)
		{
			this.log.debug(this.robot.name + " => Find me")
			setTimeout(() => {
				this.findMeService.updateCharacteristic(this.platform.Characteristic.On, false);
			}, 1000);

			try
			{
				await this.robot.findMe();
			}
			catch (error)
			{
				this.log.warn(this.robot.name + " ## Cannot start find me. " + error);
				throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
			}
		}
	}

	async clean(cleanType: CleanType)
	{
		// Start automatic update while cleaning
		if (this.refresh === 'auto')
		{
			setTimeout(() => {
				this.updateRobotPeriodically();
			}, 60 * 1000);
		}

		this.log.info("Start cleaning with options type: " + cleanType + ", eco: " + this.options.eco + ", noGoLines: " + this.options.noGoLines + ", extraCare: " + this.options.extraCare);

		try
		{
			switch (cleanType)
			{
				case CleanType.ALL:
					await this.robot.startCleaning(this.options.eco, this.options.extraCare ? 2 : 1, this.options.noGoLines);
					this.spotClean = false;
					break;
				case CleanType.SPOT:
					await this.robot.startSpotCleaning(this.options.eco, this.options.spot.width, this.options.spot.height, this.options.spot.repeat, this.options.extraCare ? 2 : 1);
					this.spotClean = true;
					break;
			}
		}
		catch (error)
		{
			this.log.error("Cannot start cleaning. " + error);
		}
	}

	async updateRobot()
	{
		// Data is outdated
		if (typeof (this.robot.lastUpdate) === 'undefined' || new Date().getTime() - this.robot.lastUpdate > 2000)
		{
			debug(this.robot.name + ": ++ Updating robot state");
			this.robot.lastUpdate = new Date().getTime();
			try
			{
				await this.robot.getState();

				// Set options initially by api
				if (typeof this.options.eco == 'undefined')
				{
					this.options.eco = this.robot.eco;
					this.options.noGoLines = this.robot.noGoLines;
					this.options.extraCare = this.robot.navigationMode == 2;
					this.log.debug("Options initially set to eco: " + this.options.eco + ", noGoLines: " + this.options.noGoLines + ", extraCare: " + this.options.extraCare);
				}
			}
			catch (error)
			{
				this.log.error("Cannot update robot " + this.robot.name + ". Check if robot is online. " + error);
				return false;
			}
		}
	}

	async updateRobotPeriodically()
	{
		await this.updateRobot()
		await this.updateCharacteristics();

		// Clear any other overlapping timers for this robot
		clearTimeout(this.robot.timer);

		// Tell all accessories of this robot (mainAccessory and roomAccessories) that updated robot data is available
		// this.robot.mainAccessory.updated();
		// this.robot.roomAccessories.forEach(accessory => {
		// 	accessory.updated();
		// });

		// Periodic refresh interval set in config
		if (this.refresh !== 'auto' && this.refresh !== 0)
		{
			this.log.debug(this.robot.name + " ## Next background update in " + this.refresh + " seconds");
			this.robot.timer = setTimeout(this.updateRobotPeriodically.bind(this), this.refresh * 1000);
		}
		// Auto refresh set in config (cleaning)
		else if (this.refresh === 'auto' && !this.robot.canPause)
		{
			this.log.debug(this.robot.name + " ## Next background update in 30 minutes (auto mode)");
			this.robot.timer = setTimeout(this.updateRobotPeriodically.bind(this), 30 * 60 * 1000);
		}
		// Auto refresh set in config (cleaning)
		else if (this.refresh === 'auto' && this.robot.canPause)
		{
			this.log.debug(this.robot.name + " ## Next background update in 60 seconds while cleaning (auto mode)");
			this.robot.timer = setTimeout(this.updateRobotPeriodically.bind(this), 60 * 1000);
		}
		// No refresh
		else
		{
			debug(this.robot.name + " ## Stopped background updates");
		}
	}

	async updateCharacteristics()
	{
		// Update Switches
		// Clean
		this.cleanService.updateCharacteristic(this.platform.Characteristic.On, await this.getClean());

		// Spot Clean
		this.spotCleanService.updateCharacteristic(this.platform.Characteristic.On, await this.getSpotClean());

		// Go To Dock
		this.goToDockService.updateCharacteristic(this.platform.Characteristic.On, await this.getGoToDock());

		// // Schedule
		// this.scheduleService.updateCharacteristic(this.platform.Characteristic.On, await this.getSchedule());

		// Battery
		this.batteryService.updateCharacteristic(this.platform.Characteristic.BatteryLevel, this.robot.charge);
		this.batteryService.updateCharacteristic(this.platform.Characteristic.ChargingState, this.robot.isCharging);
	}
}

enum CleanType
{
	ALL,
	SPOT
}
