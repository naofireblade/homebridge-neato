# homebridge-neato

This is a plugin for [homebridge](https://github.com/nfarina/homebridge) to control your [Neato](https://www.neatorobotics.com/) vacuum robot. You can download it via [npm](https://www.npmjs.com/package/homebridge-neato).

Feel free to leave any feedback [here](https://github.com/naofireblade/homebridge-neato/issues).

# Features

- Start and pause cleaning
- Return to dock\*
- Enable and disable schedule
- Enable and disable eco mode
- Get battery info
- Get dock info
- Periodic refresh of robot state

\* The robot needs to clean for some seconds before he knows where his dock is. After this time the switch to send him home will be automatically available.

**Hint:** To control the robot with your own commands just set up a scene with the name of your choice.

# Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-neato`
3. If you don't have a Neato account yet create one [here](https://www.neatorobotics.com/create-account/).
4. Update your configuration file. See the sample below.

### Configuration

Add the following information to your config file. Change the values for name, email and password.

The parameter **refresh** is optional (default 0=off) and adjusts in what interval (seconds) changes of the robot state will be pushed to homekit. The minimum refresh time is 60 seconds. You need this only when you set up rules based on the robot state and start him outside of homekit (e.g. with the Neato app).

```json
"accessories": [
	{
		"accessory": "NeatoVacuumRobot",
		"name": "YourRobot",
		"email": "YourEmail",
		"password": "YourPassword",
		"refresh": "0"
	}
]
```

# Tested robots

- BotVac Connected (Firmware 2.2.0)
- BotVac D5 Connected

If you have another connected neato robot, please [tell me](https://github.com/naofireblade/homebridge-neato/issues) about your experience with this plugin.