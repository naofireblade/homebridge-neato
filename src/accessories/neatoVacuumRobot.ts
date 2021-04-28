import {CharacteristicValue, PlatformAccessory, Service} from 'homebridge';
import {HomebridgeNeatoPlatform} from '../homebridgeNeatoPlatform';

const debug = require('debug')('my-app:my-module');
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class NeatoVacuumRobotAccessory
{
	private cleanService: Service;
	private robot: any;
	// private goToDockService: Service;
	// private dockStateService: Service;
	// private ecoService: Service;
	// private noGoLinesService: Service;
	// private extraCareService: Service;
	// private scheduleService: Service;
	// private findMeService: Service;
	// private spotCleanService: Service;

	/**
	 * These are just used to create a working example
	 * You should implement your own code to track the state of your accessory
	 */

	constructor(
			private readonly platform: HomebridgeNeatoPlatform,
			private readonly accessory: PlatformAccessory,
			private readonly isNew: Boolean)
	{
		this.robot = accessory.context.robot;
		
		// set accessory information
		this.accessory.getService(this.platform.Service.AccessoryInformation)!
				.setCharacteristic(this.platform.Characteristic.Manufacturer, "Neato Robotics")
				.setCharacteristic(this.platform.Characteristic.Model, this.robot.meta.modelName)
				.setCharacteristic(this.platform.Characteristic.SerialNumber, this.robot._serial)
				.setCharacteristic(this.platform.Characteristic.FirmwareRevision, this.robot.meta.firmware)
				.setCharacteristic(this.platform.Characteristic.Name, this.robot.name);


		let cleanServiceName = robot.name + " Clean";
		this.cleanService = this.accessory.getService(cleanServiceName) || this.accessory.addService(this.platform.Service.Switch, cleanServiceName, "CLEAN");
		
		this.cleanService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setClean.bind(this))
				.onGet(this.getClean.bind(this));

		// /**
		//  * Updating characteristics values asynchronously.
		//  *
		//  * Example showing how to update the state of a Characteristic asynchronously instead
		//  * of using the `on('get')` handlers.
		//  * Here we change update the motion sensor trigger states on and off every 10 seconds
		//  * the `updateCharacteristic` method.
		//  *
		//  */
		// let motionDetected = false;
		// setInterval(() => {
		// 	// EXAMPLE - inverse the trigger
		// 	motionDetected = !motionDetected;
		//
		// 	// push the new value to HomeKit
		// 	motionSensorOneService.updateCharacteristic(this.platform.Characteristic.MotionDetected, motionDetected);
		// 	motionSensorTwoService.updateCharacteristic(this.platform.Characteristic.MotionDetected, !motionDetected);
		//
		// 	this.platform.log.debug('Triggering motionSensorOneService:', motionDetected);
		// 	this.platform.log.debug('Triggering motionSensorTwoService:', !motionDetected);
		// }, 10000);
	}


	async setClean(on: CharacteristicValue)
	{
		// TODO debug(this.robot.name + ": " + (on ? "Enabled ".brightGreen : "Disabled".red) + " Clean " + (this.boundary ? JSON.stringify(this.boundary) : ''));
		this.platform.updateRobot(this.robot._serial, (error, result) =>
		{
			// Start
			if (on)
			{
				// No room given or same room
				if (this.boundary == null || this.robot.cleaningBoundaryId === this.boundary.id)
				{
					// Resume cleaning
					if (this.robot.canResume)
					{
						debug(this.name + ": ## Resume cleaning");
						this.robot.resumeCleaning((error) =>
						{
							callback(error);
						});
					}
					// Start cleaning
					else if (this.robot.canStart)
					{
						this.clean(callback);
					}
					// Cannot start
					else
					{
						debug(this.name + ": Cannot start, maybe already cleaning (expected)");
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
							this.nextRoom = this.boundary.id;
							callback();
						});
					}
					// Start new cleaning of new room
					else
					{
						debug(this.name + ": ## Start cleaning of new room");
						this.clean(callback);
					}
				}
			}
			// Stop
			else
			{
				if (this.robot.canPause)
				{
					debug(this.name + ": ## Pause cleaning");
					this.robot.pauseCleaning((error) =>
					{
						callback(error);
					});
				}
				else
				{
					debug(this.name + ": Already paused");
					callback();
				}
			}
		});
	}
	
	async getClean(): Promise<CharacteristicValue>
	{
		// implement your own code to check if the device is on
		const isOn = this.exampleStates.On;

		this.platform.log.debug('Get Characteristic On ->', isOn);

		// if you need to return an error to show the device as "Not Responding" in the Home app:
		// throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

		return isOn;
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
