# What is this?

This is a plugin for Visual Studio Code that enables integration with the Veracode platform.

Currently, this only supports flaw download, but will be enhanced to support upload as well in the future.

<p align=center>
<img src="media/ScreenShot_2020-09-01.png">
</p>

# Upgrading

Nothing yet.

# Installing

This is not (yet) in the VSCode marketplace so you need to do a manual install. Grab the latest file from the releases directory and do a [manual install](https://stackoverflow.com/questions/42017617/how-to-install-vs-code-extension-manually)

# Plugin Configuration

This extension contributes the following settings (default values are shown in parenthesis):

* `veracode.credsFile`: (<your_home_directory>/.veracode/credentials)
  * a text file of the format 
  ```
  [default]
  veracode_api_key_id = <your_veracode_api_id>
  veracode_api_key_secret = <your_veracode_api_key>
  ```
* `veracode.API profile in configuration file`: The profile (or section) of API credentials to be used for communicating with Veracode Platform. (showing `default` in the above example).
* `veracode.scanCount`: (10) Number of scans to show for each app.  Scans will be shown from newest to oldest.
* `veracode.sandboxCount`: (5) Number of sandboxes to show for each app
* `veracode.logLevel`: (info) Logging level that shows in the Debug Console.  Will require a restart for changes to take effect.
* `veracode.proxyHost`: (none) Proxy host name (e.g., https://my-proxy.com)
* `veracode.proxyPort`: (none) Port on the proxy host (e.g., 8080)
* `veracode.proxyName`: (none) Username if the proxy host requires a login 
* `veracode.proxyPassword`: (none) Password if the proxy host requires a login

# Workspace Configuration
One of the latest features enable bringing in only a single application and specific sandbox to the current workspace.  
To enable this, please add the a file name `veracode-plugin.conf` to the project root directory. The file content should be as follow:
```
[import]
# Application name filtering
application=Teast CSharp
# Sandbox filtering
sandbox=__policy
```
The configuration allow to filter with exact name (application and/or sandbox).  
To get only the scans in the main policy (not in sandbox), set: `sandbox=__policy` 


# Building

[Clone](https://www.atlassian.com/git/tutorials/setting-up-a-repository/git-clone)

run npm install

# Help with problems
Please log an issue.  You can get extra info by changing the veracode.logLevel to debug and viewing the debug log in the Developer Tools Console.  Help --> Developer Tools (Console tab)

# A note about the author
While it's true that [I](https://gitlab.com/buzzcode) work for Veracode, this is NOT an official Veracode-supported product.  I've written this in my own time in an effort to help support our customers.

Over time, the plugin added additional features, the contribution of my colleagues from Veracode.



