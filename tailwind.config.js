// tailwind.config.js
export default {
    content: [
      "./src/**/*.{html,js,jsx,ts,tsx}",
    ],
    theme: {
      extend: {
        fontFamily: {
          garamond: ['Garamond', 'serif'],
        },
        colors: {
          customColor: '#AA405B',
          customRed: '#E02424',    // file-sharing pdf red
          customGreen: '#207245',  // file-sharing excel
          customBlue: '#2A5699',   // file-sharing word blue
        },
      },
    },
    plugins: [],
  }
  