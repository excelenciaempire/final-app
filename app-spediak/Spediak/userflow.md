# How the Spediak App Works (User Flow - Aligned with Design)

Here's a step-by-step description of how a user interacts with the Spediak app, based on the visual design and planned functionality:

1.  **Login or Sign Up:**
    * The user opens the app and sees a clean **Login screen** with the "Spediak" title.
    * They can enter their email and password to log in or tap "Sign Up" at the bottom.
    * If signing up, they see the **Create Account screen**, enter their full name, email, password, and confirm password, then tap "Create Account".
    * If they forgot their password, they tap "Forgot Password?" on the Login screen, enter their email on the **Reset Password screen**, and tap "Reset Password" to receive reset instructions.
    * Clerk handles the secure authentication process in the background.

2.  **The Main Hub: New Inspection Screen:**
    * Upon successful login, the user lands directly on the **New Inspection screen**.
    * The header displays a hamburger menu icon (☰) and the title "New Inspection".
    * Below the header, the user's currently selected state (e.g., "North Carolina") is shown.

3.  **Creating an Inspection Report:**
    * The user taps the large **image upload area**. This opens the device's options to either take a new photo with the camera or select an existing photo from the gallery.
    * The chosen image appears in the upload area.
    * The user taps into the **text input field** below the image (placeholder: "Describe the inspection issue...") and types a description.
    * *Alternatively*, the user taps the **microphone icon** on the right side of the text field. This starts an audio recording. The user speaks their description and taps again (or a stop button appears) to finish recording.
    * The app sends the recording to Deepgram for transcription, and the resulting text automatically appears in the description field.
    * Once both an image is present and the description field is filled (typed or transcribed), the blue **"Generate DDID Response" button** becomes active.
    * The user taps the "Generate DDID Response" button.

4.  **AI Analysis & Report Modal:**
    * The app shows a brief loading indicator while communicating with the backend and OpenAI.
    * A **modal window** pops up over the screen, titled "DDID Report".
    * Inside the modal, the user reads the AI-generated DDID paragraph, which is formatted with bold headings like **Defect:**, **Description:**, and **Implication:**.
    * The user can tap the **"Copy Report" button** at the bottom of the modal to copy the DDID text to their clipboard.
    * The user taps the **'X' icon** in the top-right corner of the modal to close it and return to the New Inspection screen.

5.  **Automatic Saving:**
    * In the background, as soon as the DDID is successfully generated, the app automatically saves the report details (image reference, description, generated DDID, user's state) to the database via the secure backend, linked to the user's account.

6.  **Navigation via Drawer Menu:**
    * To access other parts of the app, the user taps the **hamburger menu icon (☰)** in the top-left corner.
    * A **drawer menu slides out** from the left.
    * The top of the drawer displays the user's profile picture, name, email, and selected state.
    * The user sees menu options: "New Inspection", "Inspection History", and "Profile".
    * At the bottom of the drawer is a "Log Out" option.

7.  **Viewing Past Reports (Inspection History):**
    * The user taps "Inspection History" in the drawer menu.
    * The **Inspection History screen** appears, showing a header and a **search bar** ("Search inspections...").
    * Below the search bar is a **scrollable list** of previously saved reports. Each list item displays a small thumbnail image, a snippet of the description, the date/time it was created, and a **delete icon** (trash can) on the right.
    * The user can type in the search bar to filter the list.
    * The user taps on the main area of a list item (not the delete icon). This opens the **DDID Report modal** again, displaying the full DDID text for that specific past report. They can copy or close this modal.
    * Alternatively, the user taps the **delete icon** next to a report. A confirmation prompt appears. If confirmed, the report is removed from the list and the database.

8.  **Managing Your Profile (Profile Settings):**
    * The user taps "Profile" in the drawer menu.
    * The **Profile screen** appears in **View Mode**. It shows the user's profile picture, name, email, and selected state. The header has an **Edit icon** (pencil). A **"Log Out" button** is at the bottom.
    * The user taps the **Edit icon**. The screen switches to **Edit Mode**.
    * In Edit Mode, the header icon changes to an **'X' (Close icon)**.
    * The user can tap the **camera overlay icon** on the profile picture to choose a new picture.
    * The user can tap into the **name field** and type to change their name.
    * The user taps the **state dropdown** and selects either "North Carolina" or "South Carolina".
    * The user taps the blue **"Save Changes" button**. The app updates the profile information (via Clerk) and the selected state preference. The screen returns to View Mode, reflecting the changes.
    * If the user taps the 'X' icon in Edit Mode, changes are discarded, and the screen returns to View Mode.
    * From View Mode, the user can tap the **"Log Out" button** at the bottom to sign out of the application.

9.  **Platform Usage:**
    * The user experiences this flow consistently whether using the app on an iOS device, an Android device, or through a web browser, although performance or specific UI interactions for device features (camera, microphone) might vary slightly on the web depending on the browser.

