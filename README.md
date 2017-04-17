# homebridge-neato

This is a plugin to control your [Neato](https://www.neatorobotics.com/) vacuum robot.

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-neato
3. Update your configuration file. See the sample below.

# Configuration

Configuration sample:

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

# Features

- Atart and pause cleaning
- Return to base
- Enable and disable schedule
- Enable and disable eco mode
- Get battery info

# Tested robots

- BotVac Connected Firmware 2.2.0

if you have another connected neato robot, please [tell me](https://github.com/naofireblade/homebridge-neato/issues/new) your experience with this plugin.