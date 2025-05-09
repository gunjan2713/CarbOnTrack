# Welcome to the CarbOnTrack!

The CarbOnTrack project aims to address the growing need for environmental sustainability by empowering individuals to monitor and reduce their carbon footprint through informed commuting choices. Using GPS technology, this iOS mobile application tracks users' travels automatically, computes their carbon emissions depending on the mode of transportation, and offers useful information such as daily and weekly summaries of the user’s carbon so as to inspire environmentally beneficial behavior. CarbOnTrack aims to contribute to global efforts in combating climate change by fostering individual accountability and sustainable behavior.

## Setting Up & Running Instructions

### Frontend Setup
#### 1. Clone the Frontend Repository
```

cd CarbOnTrack
```
#### 2. Install Frontend Dependencies
Navigate to the project directory and install the necessary dependencies using npm:
```
npm install
```
#### 3. 
```
npm install -g eas-cli

```
Move to Expo page and create an acount https://expo.dev/

#### 4. Login to Expo
```
eas login

```
If you have the developer account then
#### 5. 
```
npx expo install expo-dev-client
```
Otherwise make sure you have Xcode emulator installed with iphone device, this is an emulator to testv your application locally
#### 6. 
```
eas build --platform ios

```
#### 7. 
```
npx expo run

```
Press i on keyboard and it will open Xcode with the application 
