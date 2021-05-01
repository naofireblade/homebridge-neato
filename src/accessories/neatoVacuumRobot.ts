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
		this.refresh = (this.config)['refresh'];

		// set accessory information
		this.accessory.getService(this.platform.Service.AccessoryInformation)!
				.setCharacteristic(this.platform.Characteristic.Manufacturer, "Neato Robotics")
				.setCharacteristic(this.platform.Characteristic.Model, this.robot.meta.modelName)
				.setCharacteristic(this.platform.Characteristic.SerialNumber, this.robot._serial)
				.setCharacteristic(this.platform.Characteristic.FirmwareRevision, this.robot.meta.firmware)
				.setCharacteristic(this.platform.Characteristic.Name, this.robot.name);

		let cleanServiceName = this.robot.name + " Clean";
		let findMeServiceName = this.robot.name + " Find Me";
		let goToDockServiceName = this.robot.name + " Go to Dock";
		let dockStateServiceName = this.robot.name + " Docked";
		let ecoServiceName = this.robot.name + " Eco Mode";
		let noGoLinesServiceName = this.robot.name + " NoGo Lines";
		let extraCareServiceName = this.robot.name + " Extra Care";
		let scheduleServiceName = this.robot.name + " Schedule";
		let spotCleanServiceName = this.robot.name + " Clean Spot";

		this.cleanService = this.getSwitchService(cleanServiceName);
		this.findMeService = this.getSwitchService(findMeServiceName);
		this.goToDockService = this.getSwitchService(goToDockServiceName);
		this.dockStateService = this.accessory.getService(dockStateServiceName) || this.accessory.addService(this.platform.Service.Switch, dockStateServiceName, dockStateServiceName);
		this.ecoService = this.getSwitchService(ecoServiceName);
		this.noGoLinesService = this.getSwitchService(noGoLinesServiceName);
		this.extraCareService = this.getSwitchService(extraCareServiceName);
		this.scheduleService = this.getSwitchService(scheduleServiceName);
		this.spotCleanService = this.getSwitchService(spotCleanServiceName);

		this.cleanService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setClean.bind(this))
				.onGet(this.getClean.bind(this));
		this.findMeService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setFindMe.bind(this))
				.onGet(this.getFindMe.bind(this));
		this.goToDockService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setFindMe.bind(this))
				.onGet(this.getFindMe.bind(this));
		this.dockStateService.getCharacteristic(this.platform.Characteristic.On)
				.onGet(this.getFindMe.bind(this));
		this.ecoService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setFindMe.bind(this))
				.onGet(this.getFindMe.bind(this));
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
				.onSet(this.setFindMe.bind(this))
				.onGet(this.getFindMe.bind(this));
	}

	getSwitchService(servicename: string)
	{
		return this.accessory.getService(servicename) || this.accessory.addService(this.platform.Service.Switch, servicename, servicename)
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
				// No room given or same room
				if (this.robot.boundary == null || this.robot.cleaningBoundaryId === this.robot.boundary.id)
				{
					// Resume cleaning
					if (this.robot.canResume)
					{
						debug(this.robot.name + ": ## Resume cleaning");
						await this.robot.resumeCleaning();
						return;
					}
					// Start cleaning
					else if (this.robot.canStart)
					{
						// TODO this.clean(callback);
					}
					// Cannot start
					else
					{
						// TODO debug(this.name + ": Cannot start, maybe already cleaning (expected)");
						return;
					}
				}
				// Different room given
				else
				{
					// Return to dock
					if (this.robot.canPause || this.robot.canResume)
					{
						// debug(this.name + ": ## Returning to dock to start cleaning of new room");
						// this.setGoToDock(true, (error, result) =>
						// {
						// 	this.nextRoom = this.boundary.id;
						// 	callback();
						// });
					}
					// Start new cleaning of new room
					else
					{
						// debug(this.name + ": ## Start cleaning of new room");
						// this.clean(callback);
					}
				}
			}
			// Stop
			else
			{
				if (this.robot.canPause)
				{
					// debug(this.name + ": ## Pause cleaning");
					// this.robot.pauseCleaning((error) => {
					// 	callback(error);
					// });
				}
				else
				{
					// debug(this.name + ": Already paused");
					// callback();
				}
			}
		}
		catch (error)
		{
			this.log.warn("Cannot start cleaning: " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	async getClean(): Promise<CharacteristicValue>
	{
		try
		{
			await this.updateRobot();

			let cleaning;
			if (this.robot.boundary == null)
			{
				cleaning = this.robot.canPause;
			}
			else
			{
				cleaning = this.robot.canPause && (this.robot.cleaningBoundaryId === this.robot.boundary.id)
			}

			// TODO debug(this.robot.name + ": Cleaning is " + (cleaning ? 'ON'.brightGreen : 'OFF'.red));
			return cleaning;
		}
		catch (error)
		{
			this.log.warn("Cannot get cleaning status: " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}


	getFindMe()
	{
		return false;
	}

	async setFindMe(on: CharacteristicValue)
	{
		if (on)
		{
			// TODO debug(this.name + ": ## Find me");
			setTimeout(() => {
				this.findMeService.updateCharacteristic(this.platform.Characteristic.On, false);
			}, 1000);

			try
			{
				await this.robot.findMe();
			}
			catch (error)
			{
				this.log.warn("Cannot start find me: " + error);
				throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
			}
		}
	}

	async updateRobot()
	{
		// Data is up to date
		if (typeof (this.robot.lastUpdate) !== 'undefined' && new Date().getTime() - this.robot.lastUpdate < 2000)
		{
			return;
		}
		else
		{
			debug(this.robot.name + ": ++ Updating robot state");
			this.robot.lastUpdate = new Date().getTime();
			try
			{
				await this.robot.getState();
			}
			catch (error)
			{
				this.log.error("Cannot update robot " + this.robot.name + ". Check if robot is online. " + error);
				return false;
			}
		}
	}

	async clean(boundary, spot)
	{
		// Start automatic update while cleaning
		if (this.refresh === 'auto')
		{
			setTimeout(() => {
				this.updateRobotPeriodically();
			}, 60 * 1000);
		}

		let eco = this.ecoService.getCharacteristic(this.platform.Characteristic.On).value;
		let extraCare = this.extraCareService.getCharacteristic(this.platform.Characteristic.On).value;
		let nogoLines = this.noGoLinesService.getCharacteristic(this.platform.Characteristic.On).value;
		let room = (boundary == null) ? '' : boundary.name;
		// debug(this.robot.name + ": ## Start cleaning (" + (room !== '' ? room + " " : '') + "eco: " + eco + ", extraCare: " + extraCare + ", nogoLines: " + nogoLines + ", spot: " + JSON.stringify(spot) + ")");
		debug(this.robot.name + ": ## Start cleaning eco: " + eco + ", extraCare: " + extraCare + ", nogoLines: " + nogoLines + ", spot: " + JSON.stringify(spot) + ")");

		// Normal cleaning
		if (boundary == null && (typeof spot === 'undefined'))
		{
			try
			{
				await this.robot.startCleaning(eco, extraCare ? 2 : 1, nogoLines);
			}
			catch (error)
			{
				this.log.error("Cannot start cleaning. " + error);
			}
		}
		// Room cleaning
		else if (room !== '')
		{
			try
			{
				await this.robot.startCleaningBoundary(eco, extraCare, boundary.id);
			}
			catch (error)
			{
				this.log.error("Cannot start room cleaning. " + error);
			}
		}
		// Spot cleaning
		else
		{
			try
			{
				await this.robot.startSpotCleaning(eco, spot.width, spot.height, spot.repeat, extraCare ? 2 : 1);
			}
			catch (error)
			{
				this.log.error("Cannot start spot cleaning. " + error);
			}
		}
	}

	async updateRobotPeriodically()
	{
		await this.updateRobot()

		// Clear any other overlapping timers for this robot
		clearTimeout(this.robot.timer);

		// Tell all accessories of this robot (mainAccessory and roomAccessories) that updated robot data is available
		this.robot.mainAccessory.updated();
		this.robot.roomAccessories.forEach(accessory => {
			accessory.updated();
		});

		// Periodic refresh interval set in config
		if (this.refresh !== 'auto' && this.refresh !== 0)
		{
			this.log.debug(this.robot.device.name + ": ++ Next background update in " + this.refresh + " seconds");
			this.robot.timer = setTimeout(this.updateRobotPeriodically.bind(this), this.refresh * 1000);
		}
		// Auto refresh set in config
		else if (this.refresh === 'auto' && this.robot.device.canPause)
		{
			this.log.debug(this.robot.device.name + ": ++ Next background update in 60 seconds while cleaning (auto mode)");
			this.robot.timer = setTimeout(this.updateRobotPeriodically.bind(this), 60 * 1000);
		}
		// No refresh
		else
		{
			debug(this.robot.device.name + ": ++ Stopped background updates");
		}
	}


	// /**
	//  * Handle the "GET" requests from HomeKit
	//  * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
	//  *
	//  * GET requests should return as fast as possbile. A long delay here will result in
	//  * HomeKit being unresponsive and a bad user experience in general.
	//  *
	//  * If your device takes time to respond you should update the status of your device
	//  * asynchronously instead using the `updateCharacteristic` method instead.
	//
	//  * @example
	//  * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
	//  */
	// async getOn(): Promise<CharacteristicValue>
	// {
	// 	// implement your own code to check if the device is on
	// 	const isOn = this.exampleStates.On;
	//
	// 	this.platform.log.debug('Get Characteristic On ->', isOn);
	//
	// 	// if you need to return an error to show the device as "Not Responding" in the Home app:
	// 	// throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
	//
	// 	return isOn;
	// }
}
