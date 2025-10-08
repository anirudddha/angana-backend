import jwt from "jsonwebtoken";

const token = jwt.sign(
  { id: "b53ffc97-c791-4582-969b-a02bc9c1c1d1" },
  "this-project-need-to-be-the-scuccesful-and-good",
  { expiresIn: "1h" }
);

console.log(token);