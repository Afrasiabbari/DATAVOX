DATAVOX — Windows Desktop Foundation
Afrasiab Labs

WHAT THIS BUILD IS
- A first Windows desktop foundation using WPF and .NET Framework 4.8.
- Separate Copy Files and Settings screens.
- Two main copy fields: SOURCE LOCATION and DESTINATION LOCATION.
- Select a single file or a folder as the source, then choose an existing destination folder.
- Copies files only. It does not delete or move source files.
- Existing destination files are skipped in this initial foundation.
- Cancellation stops further copying; files already copied remain at destination.

IMPORTANT LIMITATIONS
- This is a development source project, not a signed installer or finished commercial release.
- Dashboard, advanced queues, robust conflict resolution, integrity verification, and complete theme polish are not included yet.
- The initial UI is a functional foundation and needs testing on the target Windows versions before distribution.
- Copying large folders may take time to enumerate; later milestones will add more detailed, cancellable scanning and per-file progress.

BUILD ON WINDOWS
The application is compiled by the project maintainer using the repository Windows build workflow. End users install the prebuilt release package and do not need Visual Studio or build tools.

PLATFORM
- .NET Framework 4.8 supports compatible Windows 10 x86/x64 editions and Windows 11 x64.
- Build architecture can be configured in Visual Studio for x86 or x64 as needed.
- Windows 11 has no 32-bit edition.

SAFETY
- This foundation only copies; it does not delete or move the source.
- Back up important files before testing any new file utility.
