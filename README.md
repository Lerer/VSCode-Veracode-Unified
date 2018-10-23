# What is this?

This is a plugin for Visual Studio Code that enables integration with the Veracode platform.

Currently, this only supports flaw download, but will be enhanced to support upload as well in the future.

# Upgrading

Nothing yet.

# Installing

This is not (yet) in the VSCode marketplace so you need to do a manual install.  Grab the latest file from the releases directory and do a manual install.  See here: https://stackoverflow.com/questions/42017617/how-to-install-vs-code-extension-manually


# Configuration

This extension contributes the following settings (default values are shown in parenthesis):

* `veracode.credsFile`: (<your_home_directory>/.veracode/credentials)
  * a text file of the format 
  ```
  [default]
  veracode_api_key_id = <your_veracode_api_id>
  veracode_api_key_secret = <your_veracode_api_key>
  ```
* `veracode.scanCount`: (10) how many scans to show for each app.  Scans will be shown from newest to oldest.
* `veracode.logLevel`: (info) Logging level that shows in the Debug Console.  Will require a restart for changes to take effect.

# Building

Clone

run npm install

# Help with problems
Please log an issue.  You can get extra info by changing the veracode.logLevel to debug and viewing the debug log in the Developer Tools Console.  Help --> Developer Tools (Console tab)

# A note about the author
While it's true that I work for Veracode, this is NOT an official Veracode-supported product.  I've written this in my own time in an effort to help support our customers.



