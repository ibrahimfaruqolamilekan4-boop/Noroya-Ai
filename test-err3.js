const obj = { code: 413, message: "Too large" };
const err = new Error(obj);
console.log(err.message);
