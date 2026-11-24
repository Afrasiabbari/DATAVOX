DATAVOX - AFRASIAB LABS
Windows desktop file-copy utility

IMPORTANT: END USERS DO NOT NEED VISUAL STUDIO.
The final installer contains a precompiled DATAVOX.exe. Installation does not compile source code and does not install Visual Studio Community, Visual Studio Build Tools, MSBuild, or developer workloads.

HOW THE DISTRIBUTION IS BUILT
1. Upload this repository to GitHub.
2. Open the repository's Actions tab.
3. Select "Build DATAVOX Windows Installer" and click Run workflow (or push a source change to main/master).
4. When the workflow succeeds, open that workflow run and download the artifact named DATAVOX-Windows-Installer.
5. Extract DATAVOX-Windows-Installer.zip.

HOW CUSTOMERS INSTALL
1. Open the extracted release folder.
2. Double-click Setup.bat.
3. The setup installs DATAVOX for the current Windows user, creates a desktop shortcut, and launches it.

REQUIREMENTS
- Windows 10 or Windows 11.
- Internet connection only if the .NET Framework 4.8 runtime needs to be downloaded.
- No Visual Studio Community, Visual Studio Build Tools, MSBuild, SDK, or developer workload is required on customer PCs.

PROJECT SCOPE NOTE
The supplied WPF source is an initial file-copy foundation. It copies files/folders and has limited conflict handling. This packaging change does not add advanced copy-engine features or replace Windows Explorer's built-in copy engine. Those require separate product development and testing.
