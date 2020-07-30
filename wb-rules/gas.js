var gas_manager = require("gas");

gas_manager.start({
	id: "gas",
	title: "Gas Manager",

	sensors: [
    { name: "s_gas_home", device: "wb-gpio", control: "EXT4_IN6", activationValue: false },
	],
	valve: { device: "wb-gpio", control: "EXT3_R3A4" },

	onShot: function(shotsCount) {
		if (shotsCount) {
			log("Gas found: " + shotsCount + " times");
		} else {
			log("Gas found");
		}

		// //  siren on  //
		// dev["siren"]["siren"] = true;
		//
		// //  email  //
		// dev["email_manager"]["send"] = "Обнаружена утечка газа !!";
		//
		// //  sms  //
		// dev["sms_manager"]["send"] = "Gas found !!";
	},
	onGone: function() {
		// //  siren off  //
		// dev["siren"]["siren"] = false;
	}
});
