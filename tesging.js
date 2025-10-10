import jwt from "jsonwebtoken";

const token = jwt.sign(
  { id: "9476cbdd-9ddd-4244-992d-eb11aa6317f9" },
  "this-project-need-to-be-the-scuccesful-and-good",
  { expiresIn: "1h" }
);

console.log(token);