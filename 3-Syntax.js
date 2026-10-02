// Learning about JavaScript Syntax and Basics
// This code demonstrates basic JavaScript syntax including variables, conditionals, functions, and arrays.

// White space and indentation are important for readability but do not affect the execution of the code.

/*
Whitespace refers to characters that provide the space between other characters. JavaScript has the following whitespace:

Carriage return
Space
New Line
tab
*/

// write one example of formatted and unformatted code
// Unformatted code
var x=10;var y=20;var sum=x+y;console.log(sum);

// Formatted code   
var x = 10;
var y = 20;
var sum = x + y;
console.log(sum); // Output: 30


// Note that JavaScript bundlers remove all whitespace from JavaScript files and put them into a single file for deployment. By doing this, JavaScript bundlers make the JavaScript code lighter and faster to load in web browsers.










// Statements in JavaScript are instructions that perform actions. Each statement typically ends with a semicolon (;). Here are some examples of JavaScript statements:
// Variable declaration statement
let message = "Hello, JavaScript!";
console.log(message); // Output: Hello, JavaScript!

// Expression statement
let a = 5;
let b = 10;
let sumResult = a + b;
console.log(sumResult); // Output: 15

// Control flow statement
if (sumResult > 10) {
    console.log("The sum is greater than 10.");
} else {
    console.log("The sum is 10 or less.");
}

// Function declaration statement
function greet(name) {
    return "Hello, " + name + "!";
}

console.log(greet("Alice")); // Output: Hello, Alice!

// Loop statement
for (let i = 0; i < 5; i++) {
    console.log("Iteration: " + i);
}








// Blocks in JavaScript are used to group multiple statements together. A block is defined by curly braces {}. Here are some examples of blocks in JavaScript:
// Example of a block in an if statement
let score = 85;
if (score >= 60) {
    console.log("You passed!");
} else {
    console.log("You failed.");
}

// Example of a block in a function
function multiply(x, y) {
    let result = x * y;
    return result;
}
console.log(multiply(4, 5)); // Output: 20

// Example of a block in a loop
for (let i = 1; i <= 3; i++) {
    console.log("Count: " + i);
}

// Example of a nested block
let age = 25;   
if (age >= 18) {
    if (age < 65) {
        console.log("You are an adult.");
    }
} else {
    console.log("You are a minor.");
}

// Example of a block in a try-catch statement
try {
    let result = 10 / 0;    
    console.log(result);
} catch (error) {
    console.log("An error occurred: " + error.message);
}  

// Summary:
// - Blocks are defined by curly braces {}.
// - They group multiple statements together.
// - Commonly used in control flow statements, functions, loops, and error handling.    








// Identifiers in JavaScript are names used to identify variables, functions, and other entities. Here are some rules and examples of valid and invalid identifiers:
// Rules for valid identifiers:
// 1. Must start with a letter (a-z, A-Z), underscore (_), or dollar sign ($).
// 2. Subsequent characters can be letters, digits (0-9), underscores, or dollar signs.
// 3. Cannot be a reserved keyword in JavaScript (e.g., var, function, if, else, return, etc.).
// 4. Case-sensitive (e.g., myVar and myvar are different identifiers).

// Examples of valid identifiers:
let myVariable = 10;
let _privateVar = "Hello";
let $dollarSign = 100;
let camelCaseExample = true;
let PascalCaseExample = false;
let snake_case_example = "JavaScript";

// Examples of invalid identifiers:
// let 1stVariable = 20; // Invalid: starts with a digit
// let my-variable = 30; // Invalid: contains a hyphen
// let var = 40; // Invalid: 'var' is a reserved keyword
// let my variable = 50; // Invalid: contains a space

// Summary:
// - Identifiers are names for variables, functions, etc.
// - Must follow specific rules for validity.
// - Case-sensitive and cannot be reserved keywords.

// JavaScript is case-sensitive, meaning that it distinguishes between uppercase and lowercase letters in identifiers. Here are some examples to illustrate this concept:
let myVariable = 10;
let MyVariable = 20;
let MYVARIABLE = 30;

console.log(myVariable); // Output: 10
console.log(MyVariable); // Output: 20
console.log(MYVARIABLE); // Output: 30


// Summary:
// - JavaScript is case-sensitive.
// - Identifiers with different cases are treated as distinct entities.

// JavaScript supports three types of variable declarations: var, let, and const. Here are examples of each:
// Using var (function-scoped)
var age = 25;
console.log(age); // Output: 25
age = 30;
console.log(age); // Output: 30

// Using let (block-scoped)
let city = "New York";
console.log(city); // Output: New York
city = "Los Angeles";
console.log(city); // Output: Los Angeles
// Using const (block-scoped, constant)
const country = "USA";
console.log(country); // Output: USA
// country = "Canada"; // This will throw an error because const variables cannot be reassigned 

// Summary:
// - Use var for function-scoped variables.
// - Use let for block-scoped variables that may change.
// - Use const for block-scoped variables that should remain constant.














// Comments in JavaScript are used to add explanations or notes within the code. They are ignored by the JavaScript engine during execution. There are two types of comments in JavaScript: single-line comments and multi-line comments.
// Single-line comments start with two forward slashes (//) and continue to the end of the line.
// Example of a single-line comment
let x = 10; // This is a single-line comment explaining that x is assigned the value 10 


console.log(x); // Output: 10


// Block comments in JavaScript are used to group multiple statements together. A block is defined by curly braces {}. Here are some examples of blocks in JavaScript:


// Multi-line comments start with /* and end with */. They can span multiple lines. 

/* Example of a multi-line comment
   This comment explains that the following code block
   declares a variable y and assigns it the value 20.
*/
let y = 20;
console.log(y); // Output: 20

// Summary:
// - Use // for single-line comments.
// - Use /* */ for multi-line comments.
// - Comments help improve code readability and provide explanations.


















// Expressions in JavaScript are combinations of values, variables, operators, and function calls that produce a value. Here are some examples of different types of expressions in JavaScript:
// Arithmetic expression
let a = 5;
let b = 10;
let sum = a + b; // Expression: a + b
console.log(sum); // Output: 15

// String expression
let greeting = "Hello, " + "world!"; // Expression: "Hello, " + "world!"
console.log(greeting); // Output: Hello, world!

// Function call expression
function multiply(x, y) {
    return x * y;
}
console.log(multiply(4, 5)); // Output: 20



// Logical expression
let isAdult = true;
let hasID = false;
let canEnter = isAdult && hasID; // Expression: isAdult && hasID
console.log(canEnter); // Output: false

// Conditional (ternary) expression
let age = 18;
let eligibility = (age >= 18) ? "Eligible to vote" : "Not eligible to vote"; // Expression: (age >= 18) ? "Eligible to vote" : "Not eligible to vote"
console.log(eligibility); // Output: Eligible to vote

// Summary:
// - Expressions combine values, variables, operators, and function calls.
// - They produce a value that can be used in further computations or assignments.




// Keywords and Reserved words in JavaScript are predefined words that have special meanings and purposes within the language. They cannot be used as identifiers (variable names, function names, etc.). Here are some examples of keywords and reserved words in JavaScript:
// Examples of JavaScript keywords:
let functionName = "myFunction"; // 'let' is a keyword used to declare variables    


function myFunction() { // 'function' is a keyword used to define functions
    return "Hello!";
}

console.log(myFunction()); // Output: Hello!

if (true) { // 'if' is a keyword used for conditional statements
    console.log("This is true.");
}

// Examples of JavaScript reserved words:
// let var = 10; // 'var' is a reserved word and cannot be used as a variable name
// function return() {} // 'return' is a reserved word and cannot be used as a function name
// const class = "MyClass"; // 'class' is a reserved word and cannot be used as a variable name

// Summary:
// - Keywords and reserved words have special meanings in JavaScript.
// - They cannot be used as identifiers.
// - Examples include let, function, if, var, return, class, etc.


/*

Use whitespace, including carriage return, space, newline, and tab to format the code. The JavaScript engine disregards whitespace.
Use a semicolon (;) to terminate a simple statement.
Use the curly braces ({}) to create a block that groups one or more simple statements.
A single-line comment starts with // followed by text. The JavaScript engine ignores comments.
Identifiers are names you choose for variables, functions, classes, and so on.
Avoid using reserved keywords for identifiers.

*/