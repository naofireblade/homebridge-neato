const
	index = require('./index'),
	hap = require('hap-nodejs'),
	sinon = require('sinon'),
	util = require('util');

const botvac = require("node-botvac");
// const client = require("node-botvac/lib/client");
const robot = require("node-botvac/lib/robot");

describe("homebridge-neato", () =>
{
	let homebridge;
	let platform;
	let config;

	let accessories;

	let robot;
	let client;
	let authorizationError;
	let robots;

	// Create dummy callback method for accessories() call
	let accessoriesCallback = function (acc)
	{
		accessories = acc;
	};

	beforeEach(() =>
	{
		authorizationError = null;
		robots = [];

		// Create a dummy config
		config = {
			platform: "NeatoVacuumRobot",
			email: "adress@mail.com",
			password: "password"
		};

		// Mock homebridge
		homebridge = {
			hap,
			log: {
				debugs: [],
				infos: [],
				warns: [],
				errors: [],
				debug(...message)
				{
					[].shift.apply(arguments);
					this.debugs.push(util.format("DEBUG: " + message[0], ...arguments));
					console.log("DEBUG: " + message[0], ...arguments);
				},
				info(...message)
				{
					[].shift.apply(arguments);
					this.infos.push(util.format("INFO: " + message[0], ...arguments));
					console.log("INFO: " + message[0], ...arguments);
				},
				warn(...message)
				{
					[].shift.apply(arguments);
					this.warns.push(util.format("WARN: " + message[0], ...arguments));
					console.log("WARN: " + message[0], ...arguments);
				},
				error(...message)
				{
					[].shift.apply(arguments);
					this.errors.push(util.format("ERROR: " + message[0], ...arguments));
					console.log("ERROR: " + message[0], ...arguments);
				}

			},
			registerPlatform(pluginName, accessoryName, constructor)
			{
				platform = new constructor(homebridge.log, config);
			}
		};

		// Mock robot
		robot = {
			name: "Testrobot",
			_serial: "12345",
			_secret: "s-12345",
			_token: "t-12345",
			availableServices: {
				// houseCleaning: "basic-1"
			},
			getState(callback)
			{
				callback(null, robot);
			},
			getPersistentMaps(callback)
			{
				callback(null, []);
			}
		};

		// Mock client from node-botvac lib
		client = {
			authorize(email, password, force, callback)
			{
				callback(authorizationError);
			},
			getRobots(callback)
			{
				callback(null, robots);
			}
		};

		// Stub method Client() from node-botvac api to return mocked client
		sinon.stub(botvac, "Client").returns(client);
	});

	afterEach(() =>
	{
		// Restore any stubbed mthods
		sinon.restore();
	});

	describe("Platform", () =>
	{
		it("should be registered", async () =>
		{
			// Expect method registerPlatform to be called
			const mock = sinon.mock(homebridge);
			mock.expects("registerPlatform").once();

			// Import index module and call default exports function
			const index = await import("./index");
			index.default(homebridge);

			// Verify expectations
			mock.verify();
		});
	});

	describe("Authorization", () =>
	{
		beforeEach(async () =>
		{
			// Import index module and call default exports function
			const index = await import("./index");
			index.default(homebridge)
		});

		it("should fail with wrong credentials", async () =>
		{
			// Arrange
			authorizationError = "Wrong credentials";
			let clientMock = sinon.mock(client);

			// Act
			let error = undefined;
			try
			{
				await platform.accessories(accessoriesCallback); // Get accessories
			} catch (e)
			{
				error = e;
			}

			// Assert
			expect(error).toBeDefined(); // Error should be trown and plugin stopped
			expect(homebridge.log.errors.length).toBe(1); // Error message should be logged
			expect(homebridge.log.errors[0].includes("Please check your internet connection and your credentials")).toBeTruthy();
			clientMock.expects("getRobots").never(); // Method getRobots should not be called
		});

		it("should succeed with correct credentials", async () =>
		{
			// Arrange
			let clientMock = sinon.mock(client);

			// Act
			let error = undefined;
			try
			{
				await platform.accessories(accessoriesCallback); // Get accessories
			} catch (e)
			{
				error = e;
			}

			// Assert
			expect(error).toBeUndefined(); // Error should not be trown
			expect(homebridge.log.debugs.length).toBe(1); // Login debug message should be logged
			expect(homebridge.log.debugs[0].includes("Successfully logged in to your neato account.")).toBeTruthy();
			clientMock.expects("getRobots").once(); // Method getRobots should be called
		});
	});

	describe("Get robots", () =>
	{
		beforeEach(async () =>
		{
			// Import index module and call default exports function
			const index = await import("./index");
			index.default(homebridge)
		});

		it("should fail if the api returns an error", async () =>
		{
		});

		it("should fail if the user has no robots", async () =>
		{
		});

		it("should succeed if the user has a robot", async () =>
		{
		});

		it("should succeed if the user has multiple robots", async () =>
		{
		});
	});

	describe("Get robot", () =>
	{
		describe("Get state information", () =>
		{
			it("should be skipped if the robot is offline", async () =>
			{
			});

			it("should be skipped if the robot is not smart", async () =>
			{
			});

			it("should succeed otherwise", async () =>
			{
			});
		});

		describe("Get zone cleaning maps", () =>
		{

		});
	});
});