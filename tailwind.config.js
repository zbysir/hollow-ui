module.exports = {
  mode: 'jit',
  content: [
    './src/**/*.{js,jsx,tsx,html}',
  ],
  theme: {},
  variants: {},
  plugins: [
    require('@tailwindcss/typography'),
    require("daisyui")
  ],
}