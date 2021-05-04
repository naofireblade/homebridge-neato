import {CharacteristicValue, Logger, PlatformAccessory, PlatformAccessoryEvent, PlatformConfig, Service} from 'homebridge';
import {HomebridgeNeatoPlatform} from '../homebridgeNeatoPlatform';
import {Options} from '../models/options';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class NeatoVacuumRobotAccessory
{
	// Homebridge
	private log: Logger;
	private batteryService: Service;
	private cleanService: Service | null;
	private findMeService: Service | null;
	private goToDockService: Service | null;
	private dockStateService: Service | null;
	private binFullService: Service | null;
	private ecoService: Service | null;
	private noGoLinesService: Service | null;
	private extraCareService: Service | null;
	private scheduleService: Service | null;
	private spotCleanService: Service | null;

	// Context
	private robot: any;
	private readonly options: Options;

	// Config
	private readonly backgroundUpdateInterval: number;
	private readonly prefix: boolean;
	private readonly availableServices: string[];

	// Transient
	private isSpotCleaning: boolean;
	private timer: any;

	/**
	 * These are just used to create a working example
	 * You should implement your own code to track the state of your accessory
	 */

	constructor(
			private readonly platform: HomebridgeNeatoPlatform,
			private readonly accessory: PlatformAccessory,
			private readonly config: PlatformConfig)
	{
		this.log = platform.log;

		this.robot = accessory.context.robot;
		this.options = accessory.context.options || new Options();

		this.backgroundUpdateInterval = NeatoVacuumRobotAccessory.parseBackgroundUpdateInterval(this.config['backgroundUpdate']);
		this.prefix = this.config['prefix'] || PREFIX;
		this.availableServices = this.config['services'] || SERVICES;

		this.isSpotCleaning = false;

		// Information
		this.accessory.getService(this.platform.Service.AccessoryInformation)!
				.setCharacteristic(this.platform.Characteristic.Manufacturer, "Neato Robotics")
				.setCharacteristic(this.platform.Characteristic.Model, this.robot.meta.modelName)
				.setCharacteristic(this.platform.Characteristic.SerialNumber, this.robot._serial)
				.setCharacteristic(this.platform.Characteristic.FirmwareRevision, this.robot.meta.firmware)
				.setCharacteristic(this.platform.Characteristic.Name, this.robot.name);

		// Identify
		this.accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
			this.robot.getState((error, result) => {
				this.log.info("[" + this.robot.name + "] Identified");
				if (error)
				{
					this.debug(DebugType.INFO, JSON.stringify("Error: " + error));
				}
				this.debug(DebugType.INFO, "Status: " + JSON.stringify(result));
				this.debug(DebugType.INFO,
						"Config: Background Update Interval: " + this.backgroundUpdateInterval + ", Prefix: " + this.prefix + ", Enabled services: " + JSON.stringify(this.availableServices));
			});
		});

		// Services
		this.cleanService = this.getSwitchService(RobotService.CLEAN_HOUSE);
		this.spotCleanService = this.getSwitchService(RobotService.CLEAN_SPOT);
		this.goToDockService = this.getSwitchService(RobotService.GO_TO_DOCK);
		this.dockStateService = this.getOccupancyService(RobotService.DOCKED)
		this.binFullService = this.getOccupancyService(RobotService.BIN_FULL)
		this.findMeService = this.getSwitchService(RobotService.FIND_ME);
		this.scheduleService = this.getSwitchService(RobotService.SCHEDULE);
		this.ecoService = this.getSwitchService(RobotService.ECO);
		this.noGoLinesService = this.getSwitchService(RobotService.NOGO_LINES);
		this.extraCareService = this.getSwitchService(RobotService.EXTRA_CARE);
		this.batteryService = this.accessory.getService(this.platform.Service.Battery) || this.accessory.addService(this.platform.Service.Battery)

		if (this.cleanService)
		{
			this.cleanService.getCharacteristic(this.platform.Characteristic.On)
					.onSet(this.setCleanHouse.bind(this))
					.onGet(this.getCleanHouse.bind(this));
		}
		if (this.spotCleanService)
		{
			this.spotCleanService.getCharacteristic(this.platform.Characteristic.On)
					.onSet(this.setSpotClean.bind(this))
					.onGet(this.getSpotClean.bind(this));
		}
		if (this.goToDockService)
		{
			this.goToDockService.getCharacteristic(this.platform.Characteristic.On)
					.onSet(this.setGoToDock.bind(this))
					.onGet(this.getGoToDock.bind(this));
		}
		if (this.dockStateService)
		{
			this.dockStateService.getCharacteristic(this.platform.Characteristic.OccupancyDetected)
					.onGet(this.getDocked.bind(this));
		}
		if (this.binFullService)
		{
			this.binFullService.getCharacteristic(this.platform.Characteristic.OccupancyDetected)
					.onGet(this.getBinFull.bind(this));
		}
		if (this.findMeService)
		{
			this.findMeService.getCharacteristic(this.platform.Characteristic.On)
					.onSet(this.setFindMe.bind(this))
					.onGet(this.getFindMe.bind(this));
		}
		if (this.scheduleService)
		{
			this.scheduleService.getCharacteristic(this.platform.Characteristic.On)
					.onSet(this.setSchedule.bind(this))
					.onGet(this.getSchedule.bind(this));
		}
		if (this.ecoService)
		{
			this.ecoService.getCharacteristic(this.platform.Characteristic.On)
					.onSet(this.setEco.bind(this))
					.onGet(this.getEco.bind(this));
		}
		if (this.noGoLinesService)
		{
			this.noGoLinesService.getCharacteristic(this.platform.Characteristic.On)
					.onSet(this.setNoGoLines.bind(this))
					.onGet(this.getNoGoLines.bind(this));
		}
		if (this.extraCareService)
		{
			this.extraCareService.getCharacteristic(this.platform.Characteristic.On)
					.onSet(this.setExtraCare.bind(this))
					.onGet(this.getExtraCare.bind(this));
		}

		// Start background update
		this.updateRobotPeriodically().then(() => {
			if (!accessory.context.options)
			{
				this.options.eco = this.robot.eco;
				this.options.noGoLines = this.robot.noGoLines;
				this.options.extraCare = this.robot.navigationMode == 2;
				this.debug(DebugType.INFO, "Options initially set to eco: " + this.options.eco + ", noGoLines: " + this.options.noGoLines + ", extraCare: " + this.options.extraCare);
				accessory.context.options = this.options;
			}
			else
			{
				this.debug(DebugType.INFO, "Options loaded from cache eco: " + this.options.eco + ", noGoLines: " + this.options.noGoLines + ", extraCare: " + this.options.extraCare);
			}
		});
	}

	private getSwitchService(serviceName: string)
	{
		let displayName = this.prefix ? this.robot.name + serviceName : serviceName;
		
		if (this.availableServices.includes(serviceName))
		{
			return this.accessory.getService(displayName) || this.accessory.addService(this.platform.Service.Switch, displayName, serviceName);
		}
		else
		{
			if(this.accessory.getService(displayName))
			{
				this.accessory.removeService(<Service>this.accessory.getService(displayName));
			}
			return null;
		}
	}

	private getOccupancyService(serviceName: string)
	{
		let displayName = this.prefix ? this.robot.name + serviceName : serviceName;

		if (this.availableServices.includes(serviceName))
		{
			return this.accessory.getService(displayName) || this.accessory.addService(this.platform.Service.OccupancySensor, displayName, serviceName);
		}
		else
		{
			if(this.accessory.getService(displayName))
			{
				this.accessory.removeService(<Service>this.accessory.getService(displayName));
			}
			return null;
		}
	}

	private static parseBackgroundUpdateInterval(configValue: any)
	{
		// Parse as number
		let backgroundUpdateInterval = parseInt(configValue) || BACKGROUND_INTERVAL;

		// must be integer and positive
		backgroundUpdateInterval = ((backgroundUpdateInterval % 1) !== 0 || backgroundUpdateInterval < 0) ? BACKGROUND_INTERVAL : backgroundUpdateInterval;

		return backgroundUpdateInterval;
	}

	async getCleanHouse(): Promise<CharacteristicValue>
	{
		try
		{
			await this.updateRobot();
			return this.robot.canPause && !this.isSpotCleaning;
		}
		catch (error)
		{
			this.log.error("Cannot get cleaning status: " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	async setCleanHouse(on: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set CLEAN HOUSE: " + on);
		try
		{
			await this.updateRobot();

			// Start
			if (on)
			{
				// Resume cleaning
				if (this.robot.canResume)
				{
					this.debug(DebugType.ACTION, "Resume cleaning");
					await this.robot.resumeCleaning();
				}
				// Start cleaning
				else if (this.robot.canStart)
				{
					await this.clean(CleanType.ALL)
				}
				// Cannot start
				else
				{
					this.debug(DebugType.INFO, "Cannot start, maybe already cleaning (expected)");
				}
			}
			// Stop
			else
			{
				if (this.robot.canPause)
				{
					this.debug(DebugType.ACTION, "Pause cleaning");
					await this.robot.pauseCleaning();
				}
				else
				{
					this.debug(DebugType.INFO, "Already paused");
				}
			}
		}
		catch (error)
		{
			this.log.error("Error setting cleaning to: " + on + ". " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	async getSpotClean(): Promise<CharacteristicValue>
	{
		try
		{
			await this.updateRobot();
			return this.robot.canPause && this.isSpotCleaning;
		}
		catch (error)
		{
			this.log.error("Cannot get spot cleaning status: " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	async setSpotClean(on: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set SPOT CLEAN: " + on);
		try
		{
			if (on)
			{
				await this.clean(CleanType.SPOT)
			}
			else
			{
				// TODO stop/pause
			}
		}
		catch (error)
		{
			this.log.error("Error setting spot cleaning to: " + on + ". " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	getGoToDock()
	{
		return false;
	}

	async setGoToDock(on: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set GO TO DOCK: " + on);
		if (on)
		{
			await this.updateRobot();

			setTimeout(() => {
				if (this.goToDockService)
				{
					this.goToDockService.updateCharacteristic(this.platform.Characteristic.On, false);
				}
			}, 1000);

			try
			{
				if (this.robot.canPause)
				{
					this.debug(DebugType.ACTION, "Pause cleaning to go to dock");
					await this.robot.pauseCleaning();
					setTimeout(async () => {
						await this.robot.sendToBase();
					}, 1000);
				}
				else if (this.robot.canGoToBase)
				{
					this.debug(DebugType.ACTION, "Going to dock");
					await this.robot.sendToBase();
				}
				else
				{
					this.log.warn("[" + this.robot.name + "] Can't go to dock at the moment");
				}
			}
			catch (error)
			{
				this.log.error("Error setting go to dock to: " + on + ". " + error);
				throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
			}
		}
	}

	async getDocked(): Promise<CharacteristicValue>
	{
		try
		{
			await this.updateRobot();
			return this.robot.isDocked;
		}
		catch (error)
		{
			this.log.error("Cannot get docked status: " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	async getBinFull(): Promise<CharacteristicValue>
	{
		try
		{
			await this.updateRobot();
			return this.robot.isBinFull;
		}
		catch (error)
		{
			this.log.error("Cannot get bin full status: " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	async getSchedule(): Promise<CharacteristicValue>
	{
		try
		{
			await this.updateRobot();
			return this.robot.isScheduleEnabled;
		}
		catch (error)
		{
			this.log.error("Cannot get schedule status: " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	async setSchedule(on: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set SCHEDULE: " + on);
		try
		{
			if (on)
			{
				await this.robot.enableSchedule();
			}
			else
			{
				await this.robot.disableSchedule();
			}
		}
		catch (error)
		{
			this.log.error("Error setting schedule to: " + on + ". " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	getEco()
	{
		return this.options.eco;
	}

	setEco(on: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set ECO: " + on);
		this.options.eco = <boolean>on;
	}

	getExtraCare()
	{
		return this.options.extraCare;
	}

	setExtraCare(on: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set EXTRA CARE: " + on);
		this.options.extraCare = <boolean>on;
	}

	getNoGoLines()
	{
		return this.options.noGoLines;
	}

	setNoGoLines(on: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set NOGO LINES: " + on);
		this.options.noGoLines = <boolean>on;
	}

	getFindMe()
	{
		return false;
	}

	async setFindMe(on: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set FIND ME: " + on);
		if (on)
		{
			this.debug(DebugType.ACTION, "Find me");
			setTimeout(() => {
				if (this.findMeService)
				{
					this.findMeService.updateCharacteristic(this.platform.Characteristic.On, false);
				}
			}, 1000);

			try
			{
				await this.robot.findMe();
			}
			catch (error)
			{
				this.log.error(this.robot.name + " ## Cannot start find me. " + error);
				throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
			}
		}
	}

	async clean(cleanType: CleanType)
	{
		// Enable shorter background update while cleaning
		setTimeout(() => {
			this.updateRobotPeriodically();
		}, 60 * 1000);

		this.log.info(
				"[" + this.robot.name + "] > Start cleaning with options type: " + CleanType[cleanType] + ", eco: " + this.options.eco + ", noGoLines: " + this.options.noGoLines + ", extraCare: "
				+ this.options.extraCare);

		try
		{
			switch (cleanType)
			{
				case CleanType.ALL:
					await this.robot.startCleaning(this.options.eco, this.options.extraCare ? 2 : 1, this.options.noGoLines);
					break;
				case CleanType.SPOT:
					await this.robot.startSpotCleaning(this.options.eco, this.options.spot.width, this.options.spot.height, this.options.spot.repeat, this.options.extraCare ? 2 : 1);
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
			this.robot.lastUpdate = new Date().getTime();
			try
			{
				this.robot.getState((error, result) => {
					this.isSpotCleaning = result != null && result.action == 2;

					// Battery
					this.batteryService.updateCharacteristic(this.platform.Characteristic.BatteryLevel, this.robot.charge);
					this.batteryService.updateCharacteristic(this.platform.Characteristic.ChargingState, this.robot.isCharging);
				});
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
		this.debug(DebugType.INFO, "Performing background update")

		await this.updateRobot()
		await this.updateCharacteristics();

		// Clear any other overlapping timers for this robot
		clearTimeout(this.timer);

		// Tell all accessories of this robot (mainAccessory and roomAccessories) that updated robot data is available
		// this.robot.mainAccessory.updated();
		// this.robot.roomAccessories.forEach(accessory => {
		// 	accessory.updated();
		// });

		// Periodic refresh interval set in config
		let interval;
		if (this.robot.canPause)
		{
			interval = 1;
		}
		else
		{
			interval = this.backgroundUpdateInterval;
		}

		this.debug(DebugType.INFO, "Background update done. Next update in " + interval + " minute" + (interval == 1 ? "" : "s") + ((this.robot.canPause) ? ", robot is currently cleaning." : "."));
		this.timer = setTimeout(this.updateRobotPeriodically.bind(this), interval * 60 * 1000);
	}

	async updateCharacteristics()
	{
		if (this.cleanService)
		{
			this.cleanService.updateCharacteristic(this.platform.Characteristic.On, await this.getCleanHouse());
		}
		if (this.spotCleanService)
		{
			this.spotCleanService.updateCharacteristic(this.platform.Characteristic.On, await this.getSpotClean());
		}
		if (this.goToDockService)
		{
			this.goToDockService.updateCharacteristic(this.platform.Characteristic.On, await this.getGoToDock());
		}
		if (this.dockStateService)
		{
			this.dockStateService.updateCharacteristic(this.platform.Characteristic.OccupancyDetected, await this.getDocked());
		}
		if (this.binFullService)
		{
			this.binFullService.updateCharacteristic(this.platform.Characteristic.OccupancyDetected, await this.getBinFull());
		}
		if (this.scheduleService)
		{
			this.scheduleService.updateCharacteristic(this.platform.Characteristic.On, await this.getSchedule());
		}
	}

	private debug(debugType: DebugType, message: String)
	{
		switch (debugType)
		{
			case DebugType.ACTION:
				this.log.debug("[" + this.robot.name + "] > " + message);
				break;
			case DebugType.STATUS:
				this.log.debug("[" + this.robot.name + "] " + message);
				break;
			case DebugType.INFO:
				this.log.debug("[" + this.robot.name + "] " + message);
				break;
		}
	}
}

enum CleanType
{
	ALL,
	SPOT
}

enum DebugType
{
	ACTION,
	STATUS,
	INFO
}

enum RobotService
{
	CLEAN_HOUSE = "Clean house",
	CLEAN_SPOT = "Clean spot",
	GO_TO_DOCK = "Go to dock",
	DOCKED = "Docked sensor",
	BIN_FULL = "Bin full sensor",
	FIND_ME = "Find me",
	SCHEDULE = "Schedule",
	ECO = "Eco",
	NOGO_LINES = "Nogo lines",
	EXTRA_CARE = "Extra care"
}

const BACKGROUND_INTERVAL = 30;
const PREFIX = false;
const SERVICES = Object.values(RobotService);