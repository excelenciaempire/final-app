# Spediak App - Cursor Implementation Plan (Design & Cross-Platform Adapted)

This plan outlines the steps to build the Spediak mobile application using Expo, React Native, Clerk, Neon.Tech, OpenAI, and Deepgram, incorporating the visual design specified in "Spediak App Design.pdf" and noting cross-platform considerations.

**Note on Backend:** Direct interaction with databases (Neon.Tech) and sensitive APIs (OpenAI, Deepgram) from the client-side application is insecure. This plan assumes the creation of a secure backend service (e.g., using Node.js/Express, Next.js API routes, Vercel/Netlify Functions, or Clerk's Backend API) to handle these interactions securely.

## 🔑 Environment Setup (Prerequisite)

1.  **Create `.env` file:** Create a file named `.env` in the project root.
2.  **Add API Keys and DB URL:** Populate the `.env` file with the keys provided.
    ```env
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_cHJldHR5LWNyYXdkYWQtMTAuY2xlcmsuYWNjb3VudHMuZGV2JA

    # These keys MUST NOT be prefixed with EXPO_PUBLIC_ if accessed ONLY via a backend
    # Adjust if using a backend (recommended)
    OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    DEEPGRAM_API_KEY=YOUR_DEEPGRAM_API_KEY_HERE
    DATABASE_URL=YOUR_DATABASE_URL_HERE
    ```
    * **Security:** The `OPENAI_API_KEY`, `DEEPGRAM_API_KEY`, and `DATABASE_URL` should *only* be accessed from a secure backend environment, *not* directly in the Expo app. Only the `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is safe for client-side use.
3.  **Install `expo-constants`:** If not already present, run `npx expo install expo-constants` to access environment variables.
4.  **Configure `app.json` / `app.config.js`:** To expose the public Clerk key to your app:
    ```json
    // app.json or app.config.js excerpt
     {
       "expo": {
         // ... other config
         "extra": {
           "clerkPublishableKey": process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
           // Add other necessary config like EAS projectId if using EAS Build
         }
       }
     }
    ```

## 🏗️ Step 1: Project Setup & Initial Dependencies

1.  **Initialize Expo Project:**
    ```bash
    npx create-expo-app@latest Spediak -t expo-template-blank-typescript
    cd Spediak
    ```
    *(Using TypeScript template)*
2.  **Install Core Dependencies:** Ensure all necessary libraries are installed, including those for navigation, specific UI components, and device APIs:
    ```bash
    npx expo install @react-navigation/native @react-navigation/drawer react-native-gesture-handler react-native-reanimated @clerk/clerk-expo expo-secure-store expo-av expo-image-picker expo-font expo-splash-screen expo-constants axios @react-native-picker/picker expo-clipboard expo-file-system
    ```
3.  **Configure `babel.config.js` for Reanimated:** Ensure the `react-native-reanimated/plugin` is included in your `babel.config.js`.
4.  **Set up Basic Project Structure:** Create folders: `src/screens`, `src/components`, `src/navigation`, `src/hooks`, `src/utils`, `src/assets`, `src/styles`.
5.  **Setup Basic Styles:** Create `src/styles/colors.ts` defining `COLORS.primary='#0D47A1'`, `COLORS.white='#FFFFFF'`, etc., based on the design. Consider setting up font loading via `expo-font` if using custom fonts like Inter/Roboto/SF Pro.

## 🔐 Step 2: Authentication Setup (Clerk) - Design Adapted

1.  **Configure Clerk Provider:** Wrap your `App.tsx` with `ClerkProvider` using `expo-secure-store` for `tokenCache` and retrieving the `clerkPublishableKey` via `Constants`. Use `<SignedIn>` and `<SignedOut>` components to conditionally render the appropriate navigator (Auth or Main App).
2.  **Create Authentication Screens (`src/screens/auth/`):**
    * Create `LoginScreen.tsx`, `SignUpScreen.tsx`, `ForgotPasswordScreen.tsx`.
    * **Design Implementation:** Build the UI for these screens precisely as shown on Page 2 of the design PDF. This includes:
        * The centered "Spediak" title on Login/Signup.
        * Screen titles ("Log In", "Create Account", "Reset Password") and descriptive text.
        * Styled `TextInput` components for Full Name, Email, Password (with visibility toggle icon), Confirm Password, featuring icons and rounded corners on a light background.
        * Implement the "Forgot Password?" link.
        * Style the main action buttons ("Log In", "Create Account", "Reset Password") using `COLORS.primary` for the background and white text.
        * Implement the text links at the bottom for switching between login and sign-up.
    * **Functionality:** Use Clerk hooks (`useSignIn`, `useSignUp`) and methods (`signIn.create`, `signUp.create`, etc.) to handle authentication logic.
3.  **Create Authentication Navigator (`AuthNavigator.tsx`):** Set up a Stack Navigator (`@react-navigation/stack`) to handle navigation between the Login, Sign Up, and Forgot Password screens. This navigator is rendered within `<SignedOut>` in `App.tsx`.
    * **(Cross-Platform Note:** Clerk authentication logic works well across iOS, Android, and Web.)

## 🗄️ Step 3: Backend Setup for Neon.Tech

* **(Requires Secure Backend)** Set up backend API endpoints (`POST /api/inspections`, `GET /api/inspections`, `DELETE /api/inspections/:id`) to handle database interactions securely using the Neon DB URL and Clerk backend SDK for user authentication. Adhere to the specified database schema.

## 🧠 Step 4: Backend Setup for OpenAI Vision Integration

* **(Requires Secure Backend)** Create backend endpoint `POST /api/generate-ddid`. This endpoint securely uses the `OPENAI_API_KEY`, receives image data, description, and user state, constructs the D.D.I.D. prompt for `gpt-4-vision-preview` (temp 0.2, single paragraph output), calls OpenAI, and returns the result.

## 🔊 Step 5: Backend Setup for Voice-to-Text (Deepgram)

* **(Requires Secure Backend)** Create backend endpoint `POST /api/transcribe`. This endpoint securely uses the `DEEPGRAM_API_KEY`, receives audio data (base64), calls Deepgram SDK, and returns the transcript.

## 🔄 Step 6: Main App Navigation System (Drawer) - Design Adapted

1.  **Create Main App Navigator (`RootNavigator.tsx`):**
    * Place in `src/navigation/`. Use `createDrawerNavigator`.
    * Add screens: `NewInspection` (linked to `NewInspectionScreen.tsx`), `InspectionHistory` (linked to `InspectionHistoryScreen.tsx`), `ProfileSettings` (linked to `ProfileSettingsScreen.tsx`). Set `NewInspection` as the initial route.
    * **Design Implementation:** Implement a `CustomDrawerContent` component as the `drawerContent` prop. This component should replicate the design from Page 3 of the PDF:
        * Display user's profile picture, name, email, and selected state at the top (use `useUser` hook).
        * List the navigation items ("New Inspection", "Inspection History", "Profile").
        * Include the "Log Out" option at the bottom, styled distinctly, calling Clerk's `signOut` method (`useAuth` hook).
    * Configure default `screenOptions` for the navigator to style the header (e.g., background `COLORS.primary`, tint color `COLORS.white`) as needed, matching the design.
2.  **Integrate NavigationContainer:** Ensure `NavigationContainer` in `App.tsx` correctly wraps the logic switching between `<AuthNavigator />` (in `<SignedOut>`) and `<RootNavigator />` (in `<SignedIn>`).
    * **(Cross-Platform Note:** Drawer navigation using Reanimated and Gesture Handler works well on Web, but testing complex gestures or animations is recommended.)

## 🧾 Step 7: New Inspection Screen Implementation - Design Adapted

1.  **Create Screen Component (`NewInspectionScreen.tsx`):** Place in `src/screens/`.
2.  **UI Layout & Design Implementation:** Build the UI precisely according to Page 3 of the PDF:
    * Use `SafeAreaView`. Configure header options via `navigation.setOptions` (Title "New Inspection", ensure drawer icon appears).
    * Display the user's selected state (`Text` component below the header, fetched from `useUser`).
    * Implement the image upload area: `TouchableOpacity` wrapping an `Image` component, styled with rounded corners. Show placeholder or selected image (`imageUri` state).
    * Implement the description field: Styled `TextInput` with placeholder "Describe the inspection issue...", binding to `description` state. Add the microphone icon (`TouchableOpacity`) inside or next to the input on the right.
    * Implement the "Generate DDID Response" button: Primary style (blue background, white text), disabled based on `imageUri` and `description` state or `isGenerating` state.
    * Implement the "New Chat" button: Secondary style (e.g., lighter background or border), positioned below the primary button.
3.  **State Management:** Use `useState` for `imageUri`, `imageBase64`, `description`, `isRecording`, `isTranscribing`, `isGenerating`, `generatedDdid`, `showDdidModal`, `error`.
4.  **Image Picker Logic:** Implement `pickImage` function using `expo-image-picker` (request permissions, handle result, update `imageUri`/`imageBase64` state). Attach to image area's `onPress`.
    * **(Cross-Platform Note:** Test `expo-image-picker` on Web; it might use standard file input. Ensure it handles camera/gallery selection appropriately.)
5.  **Voice Recording Logic:** Implement `startRecording`, `stopRecording` using `expo-av` (request permissions). Implement `transcribeAudio` function to read audio file using `expo-file-system` (convert to base64), call backend `/api/transcribe` (via Axios, send auth token), update `description` state. Manage `isRecording`/`isTranscribing` states. Attach logic to mic icon `onPress`.
    * **(Cross-Platform Note:** `expo-av` recording and `expo-file-system` access require careful testing on Web across different browsers, as they rely on varying browser APIs.)
6.  **Generate DDID Logic:** Implement `handleGenerateDdid` function. Set `isGenerating`. Get `imageBase64`, `description`, `userState`. Call backend `/api/generate-ddid` (via Axios, send auth token). On success, set `generatedDdid`, set `showDdidModal(true)`. Call `saveInspection` function (see below). Handle errors. Reset `isGenerating`. Attach to primary button `onPress`.
7.  **DDID Modal:** Create/Use `src/components/DdidModal.tsx`. Implement according to the design on Page 3 (title "DDID Report", subtitle, close icon, formatted text using bold for labels, "Copy Report" button). Implement copy functionality (`expo-clipboard`) and close action. Render conditionally in `NewInspectionScreen` based on `showDdidModal`.
8.  **Save Inspection Logic:** Implement `saveInspection(ddid)` function. Prepare data (`imageUri`, `description`, `ddid`, `userState`). Call backend `POST /api/inspections` (via Axios, send auth token). Log success/error.
9.  **New Inspection/Chat Logic:** Implement `resetInspection` function to clear form state (`imageUri`, `description`, etc.). Attach to "New Chat" button `onPress`.

## 🕓 Step 8: Inspection History Screen Implementation - Design Adapted

1.  **Create Screen Component (`InspectionHistoryScreen.tsx`):** Place in `src/screens/`.
2.  **State Management:** Use `useState` for `inspections`, `isLoading`, `error`, `searchQuery`, `selectedInspectionDdid`, `showDetailModal`.
3.  **Data Fetching:** Use `useFocusEffect` to call backend `GET /api/inspections` (via Axios, send auth token). Update `inspections` state. Handle loading/error states.
4.  **UI Layout & Design Implementation:** Build UI according to Page 4:
    * Configure header ("Inspection History" title).
    * Implement styled `TextInput` search bar below header ("Q Search inspections..."). Update `searchQuery` state `onChangeText`.
    * Use `FlatList` to display filtered inspections (filter based on `searchQuery`).
    * Implement `renderItem` to match the design: Rounded thumbnail `Image`, `Text` for description snippet, `Text` for formatted date/time, delete icon (`TouchableOpacity`) on the right.
    * Wrap main item content in `TouchableOpacity` for detail view trigger.
    * **(Cross-Platform Note:** Test `FlatList` performance and appearance on Web, especially with many items.)
5.  **Modal Logic:** On item tap (main TouchableOpacity), set `selectedInspectionDdid` and `showDetailModal(true)`. Render the `DdidModal` component with the selected DDID.
6.  **Delete Logic:** Implement `handleDeleteInspection(id)` function. Show confirmation. Call backend `DELETE /api/inspections/:id` (via Axios, send auth token). Refresh list on success. Attach to delete icon `onPress`.

## 👤 Step 9: Profile Settings Screen Implementation - Design Adapted

1.  **Create Screen Component (`ProfileSettingsScreen.tsx`):** Place in `src/screens/`.
2.  **State Management:** Use `useState` for `isEditing` (boolean). Use `useUser` hook from Clerk. Manage state for editable fields (name, selected state) during edit mode.
3.  **UI Layout & Design Implementation:** Build UI according to Page 5, managing view/edit states:
    * **View Mode (`!isEditing`):** Header with "Profile" title and Edit icon (pencil `TouchableOpacity`). Body with centered circular profile `Image` (`user.imageUrl`), `Text` for name (`user.fullName`), `Text` for email (`user.primaryEmailAddress.emailAddress`), `Text` for state (`user.unsafeMetadata.inspectionState`). Bottom "Log Out" button (`TouchableOpacity` calling `signOut`).
    * **Edit Mode (`isEditing`):** Header with "Profile" title and Close icon (X `TouchableOpacity`). Body with profile `Image` overlaid with camera icon (`TouchableOpacity` to trigger image picker), `TextInput` for name (styled as input field), Picker (`@react-native-picker/picker`) for State (NC/SC), "Save Changes" primary button.
4.  **Functionality:**
    * Edit/Close icons toggle `isEditing` state.
    * Camera overlay icon triggers profile picture update using `expo-image-picker` and `user.setProfileImage`. (Test picker on Web).
    * Name `TextInput` updates local state; on save, call `user.update`.
    * State Picker updates local state; on save, call `user.update({ unsafeMetadata: { inspectionState: ... } })`. Initialize picker value from `user.unsafeMetadata.inspectionState`.
    * "Save Changes" button calls relevant `user.update` methods, handles loading/error state, sets `isEditing(false)` on success.
    * Ensure the selected state is fetched and displayed correctly in other parts of the app (Drawer header, New Inspection screen) using `useUser`. Pass this state to the `/api/generate-ddid` backend call.

## 🎨 Step 10: Style and Aesthetic Guidelines

* Apply styles consistently using `StyleSheet.create` based on the visual design in the PDF and the defined `COLORS` in `src/styles/colors.ts`. Focus on layout, spacing, border radius, and typography to match the mockups.

## 📱 Step 11: Mobile/Desktop Responsiveness

* Primarily target iOS/Android. Use Flexbox for layouts. Test on Web and use `Platform.select` or `Platform.OS === 'web'` for conditional styling or logic if needed, particularly for file inputs (`expo-image-picker`) or potentially layout adjustments. Ensure touch targets are sufficiently large on mobile.

## 🔁 Step 12: Final App Workflow Review

* Mentally walk through the entire user flow (Auth -> New Inspection -> Generate -> Save -> History -> Profile -> Logout) ensuring it aligns with the design and implemented logic.

## ❗ Key Considerations During Development

* **Backend Implementation:** Crucial for security and functionality. Implement secure endpoints.
* **Error Handling:** Implement robust error handling for API calls and device interactions.
* **Loading States:** Provide visual feedback during operations.
* **State Management:** Use `useState`/`useContext` or consider libraries like Zustand/Redux Toolkit if complexity increases.
* **Security:** Never embed sensitive keys in the frontend; use the backend proxy. Authenticate backend requests.
* **Testing:** Test thoroughly on iOS, Android, and Web, covering different scenarios and edge cases.
