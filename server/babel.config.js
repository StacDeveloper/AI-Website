export default {
  presets: [
    ["@babel/preset-env"],
    {
      targets: { node: "current" },
      module: process.env.NODE_ENV === "test" ? false : "auto",
    },
  ],
};
