# Change Log
All notable changes to the "veracode" extension will be documented in this file.

## [0.2.1]
- Code optimization
- Update vulnerable component version

## [0.2.0]
- First addition of Pipeline scan from file explorer
- Added reporting of pipeline scan result as text

## [0.1.3]
- First revision for Summary report from IDE
- Remove commas the top of the SCA report
- Code restructure and clean-up

## [0.1.2]
- Fix annotation - add all spectrum of options for non-mitigated flaws
- Updated README to show the extension label

## [0.1.0]
- Added links from the flaw in the tree view
- Rename Tree view items name (flaws)
- Restructure the help
- Remove old APIs and replace with new REST APIs
- Remove deprecated libraries
- Add import SCA features
- Replace the grouping
- Added Filter options by Mitigation and Effecting Policy
- Remove the 'scan' layer in the tree view
- Configuration File updated
- Code clean-up (no TODO and no duplications) 

## [0.0.6]
- Added Axios for new api calls - request package is no longer supported
- Added ability to support comments and propose mitigations for flaws
- Flaw info in the 'Problems' pane now include the mitigation state of flaws

## [0.0.5]
- Rewrite the code to add Types
- Upgrade dependencies to the latest vscode
- Added ability to read credentials from different sections in the credentials file
- Added ability to view multiple issues in the 'PROBLEMS' pane (in oppose to one at a time)
- Added configuration file to filter applications and sandbox in the veracode view

## [0.0.4]
- download only
- significant internal re-work due to the fact that extensins run differently in the debugger vs. a normal install

## [0.0.3] 
- download only
- internal clean-up
- fixed a problem with not clearing the previous scan's results

## [0.0.2] 
- download only
- added proxy support
- added sandbox support
- internal clean-up

## [0.0.1] Initial release
- download only
- no proxy support
- very light testing w/java and .NET
