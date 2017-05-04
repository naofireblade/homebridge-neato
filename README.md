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

\* The robot needs to clean for some seconds before he knows where his dock is. After this time the switch to send him home will be automatically available.

**Hint:** To control the robot with your own commands just set up a scene with the name of your choice.

# Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-neato`
3. If you don't have a Neato account yet create one [here](https://www.neatorobotics.com/create-account/).
4. Update your configuration file. See the sample below.

### Configuration

Add the following information to your config file. Change the values for name, email and password.

```json
"accessories": [
	{
		"accessory": "NeatoVacuumRobot",
		"name": "YourRobot",
		"email": "YourEmail",
		"password": "YourPassword"
	}
]
```

# Tested robots

- BotVac Connected (Firmware 2.2.0)

If you have another connected neato robot, please [tell me](https://github.com/naofireblade/homebridge-neato/issues) your experience with this plugin.