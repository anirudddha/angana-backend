import jwt from "jsonwebtoken";

const token = jwt.sign(
  { id: "33353894-2820-4655-81d2-0548339ad3bc" },
  "this-project-need-to-be-the-scuccesful-and-good",
  { expiresIn: "1h" }
);

console.log(token);