const
	index = require('./index'),
	hap = require('hap-nodejs'),
	sinon = require('sinon');

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
				debug(...message)
				{
					[].shift.apply(arguments);
					console.log("DEBUG: " + message[0], ...arguments);
				},
				info(...message)
				{
					[].shift.apply(arguments);
					console.log("INFO: " + message[0], ...arguments);
				},
				warn(...message)
				{
					[].shift.apply(arguments);
					console.log("WARN: " + message[0], ...arguments);
				},
				error(...message)
				{
					[].shift.apply(arguments);
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

	it("should register a platform", async () =>
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

	describe("authorization", () =>
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
			let error = undefined;

			// Act
			try
			{
				// Call method to get accessories
				await platform.accessories(accessoriesCallback);
			} catch (e)
			{
				error = e;
			}

			// Assert
			// Error should be defined
			expect(error).toBeDefined();
			// Method getRobots should not be called
			clientMock.expects("getRobots").never();
		});

		it("should succeed with correct credentials", async () =>
		{
			// Arrange
			let clientMock = sinon.mock(client);

			// Act
			// Call method to get accessories
			await platform.accessories(accessoriesCallback);

			// Assert
			// Method getRobots should be called
			clientMock.expects("getRobots").once();
		});
	});

	describe("blub", () =>
	{
		beforeEach(async () =>
		{
			robots = [robot];

			// Import index module and call default exports function
			const index = await import("./index");
			index.default(homebridge)
		});

		// Perform test that waits for method done() to be called
		it("should fetch a robot", async () =>
		{
			// Arrange

			// Act
			// Call method to get accessories
			await platform.accessories(accessoriesCallback);

			// Assert
			// Expect method getRobots to be called in mock of client
			const mock = sinon.mock(client);
			mock.expects("getRobots").once();
		});
	});
});