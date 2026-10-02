// Javascript data types

// In JavaScript, there are several built-in data types that can be categorized into primitive and non-primitive types. Here are the main data types in JavaScript:

// 1. Primitive Data Types:
// - Number: Represents both integer and floating-point numbers.
//   Example: let age = 25; let price = 19.99;

// - String: Represents a sequence of characters enclosed in single or double quotes.
//   Example: let name = "John Doe"; let greeting = 'Hello, World!';

// - Boolean: Represents a logical entity that can have two values: true or false.
//   Example: let isStudent = true; let hasLicense = false;

// - Undefined: Represents a variable that has been declared but not assigned a value.
//   Example: let x; console.log(x); // Output: undefined

// - Null: Represents the intentional absence of any object value.
//   Example: let y = null; console.log(y); // Output: null

// - Symbol: Represents a unique and immutable primitive value, often used as object property keys.
//   Example: let sym = Symbol('description');

// - BigInt: Represents integers with arbitrary precision, allowing for the representation of very large numbers.
//   Example: let bigIntNum = BigInt(9007199254740991);


// 2. Non-Primitive Data Types:
// - Object: Represents a collection of key-value pairs. Objects can store multiple values and complex data structures.
//   Example: let person = { name: "John", age: 30 };

// - Array: A special type of object used to store ordered collections of values.
//   Example: let numbers = [1, 2, 3, 4, 5];

// - Function: A block of reusable code that can be called with different arguments.
//   Example: function add(a, b) { return a + b; }

// Summary:
// - JavaScript has both primitive and non-primitive data types.
// - Primitive types include Number, String, Boolean, Undefined, Null, and Symbol.
// - Non-primitive types include Object, Array, and Function.
// - Understanding data types is essential for effective programming in JavaScript.

// Example usage of different data types:
let age = 30; // Number
let name = "Alice"; // String
let isStudent = false; // Boolean
let address; // Undefined
let phoneNumber = null; // Null
let uniqueId = Symbol('id'); // Symbol
let bigNumber = BigInt(12345678901234567890); // BigInt 

let person = { name: "Bob", age: 28 }; // Object
let scores = [95, 85, 76]; // Array
function add(a, b) {
  return a + b;
} // Function   

console.log("Age:", age);
console.log("Name:", name);
console.log("Is Student:", isStudent);
console.log("Address:", address);
console.log("Phone Number:", phoneNumber);
console.log("Unique ID:", uniqueId.toString());
console.log("Big Number:", bigNumber.toString());
console.log("Person:", person);
console.log("Scores:", scores);
console.log("Sum of 5 and 3:", add(5, 3));console.log(isAdult && hasID); // Expression: isAdult && hasID // Output: false

// Summary:
// - Expressions combine values, variables, operators, and function calls to produce a value.
// - Common types of expressions include arithmetic, string, function call, and logical expressions.    




// typeof operator

// In JavaScript, the `typeof` operator is used to determine the data type of a given variable or expression. It returns a string indicating the type of the operand. Here are some examples of how to use the `typeof` operator:
console.log(typeof 42); // Output: "number"
console.log(typeof "Hello, World!"); // Output: "string"
console.log(typeof true); // Output: "boolean"
console.log(typeof undefined); // Output: "undefined"

console.log(typeof null); // Output: "object" (this is a known quirk in JavaScript)
console.log(typeof { name: "Alice", age: 30 }); // Output: "object"
console.log(typeof [1, 2, 3]); // Output: "object" (arrays are a type of object)
console.log(typeof function() {}); // Output: "function"

// You can also use `typeof` with variables:
let num = 100;
let str = "JavaScript";
let bool = false;

console.log(typeof num); // Output: "number"
console.log(typeof str); // Output: "string"
console.log(typeof bool); // Output: "boolean"

// Summary:
// - The `typeof` operator returns a string indicating the type of the operand.
// - It can be used with literals, variables, and expressions to determine their data types.



// important
console.log(Number.MAX_VALUE + Number.MAX_VALUE); // Infinity
console.log(-Number.MAX_VALUE - Number.MAX_VALUE); // -Infinity
console.log(0 / 0); // NaN
console.log(Math.sqrt(-1)); // NaN
console.log(typeof NaN); // "number"
console.log(isNaN(NaN)); // true
console.log(isNaN("Hello")); // true
console.log(isNaN(123)); // false
console.log(Number.isNaN(NaN)); // true
console.log(Number.isNaN("Hello")); // false
console.log(Number.isNaN(123)); // false    
// Summary:
// - JavaScript has special numeric values: Infinity, -Infinity, and NaN.
// - NaN stands for "Not-a-Number" and indicates an invalid number operation.
// - Use isNaN() or Number.isNaN() to check for NaN values.







// NaN in javascript

// In JavaScript, NaN stands for "Not-a-Number" and is a special numeric value that represents an undefined or unrepresentable value in mathematical operations. NaN is of the type "number", but it is not equal to any value, including itself. Here are some examples and explanations of NaN in JavaScript:
console.log(typeof NaN); // Output: "number"

// Generating NaN
let result1 = 0 / 0; // Division by zero
console.log(result1); // Output: NaN
let result2 = Math.sqrt(-1); // Square root of a negative number
console.log(result2); // Output: NaN
let result3 = parseInt("Hello"); // Parsing a non-numeric string
console.log(result3); // Output: NaN
// Checking for NaN
console.log(isNaN(NaN)); // Output: true
console.log(isNaN("Hello")); // Output: true
console.log(isNaN(123)); // Output: false
console.log(Number.isNaN(NaN)); // Output: true
console.log(Number.isNaN("Hello")); // Output: false
console.log(Number.isNaN(123)); // Output: false        
// Comparing NaN
console.log(NaN === NaN); // Output: false
console.log(NaN == NaN); // Output: false   
// Summary:
// - NaN is a special numeric value representing "Not-a-Number".
// - It is of type "number" but is not equal to any value, including itself.
// - Use isNaN() or Number.isNaN() to check for NaN values.

console.log(NaN/2); // NaN
console.log(NaN == NaN); // false




// String type

// In JavaScript, a string is a sequence of characters used to represent text. Strings are enclosed in single quotes (' '), double quotes (" "), or backticks (` `) for template literals. Here are some examples and operations you can perform with strings in JavaScript:

// Declaring strings
let singleQuoteString = 'Hello, World!';
let doubleQuoteString = "JavaScript is fun!";
let templateLiteralString = `Template literals allow for multi-line strings and embedded expressions.`;
console.log(singleQuoteString); // Output: Hello, World!
console.log(doubleQuoteString); // Output: JavaScript is fun!
console.log(templateLiteralString); // Output: Template literals allow for multi-line strings and embedded expressions.

// String concatenation
let greeting = "Hello";
let name = "Alice";
let fullGreeting = greeting + ", " + name + "!";
console.log(fullGreeting); // Output: Hello, Alice!

// String length
let str = "JavaScript";
console.log(str.length); // Output: 10
// Accessing characters
console.log(str[0]); // Output: J
console.log(str.charAt(4)); // Output: S
// String methods
console.log(str.toUpperCase()); // Output: JAVASCRIPT
console.log(str.toLowerCase()); // Output: javascript   
console.log(str.indexOf("Script")); // Output: 4
console.log(str.slice(0, 4)); // Output: Java
console.log(str.replace("Java", "Type")); // Output: TypeScript 
console.log(str.split("")); // Output: ["J", "a", "v", "a", "S", "c", "r", "i", "p", "t"]
// Template literals with embedded expressions
let a = 5;
let b = 10;
let sumString = `The sum of ${a} and ${b} is ${a + b}.`;
console.log(sumString); // Output: The sum of 5 and 10 is 15.   
// Summary:
// - Strings are sequences of characters enclosed in single quotes, double quotes, or backticks.
// - You can perform various operations on strings, such as concatenation, accessing characters, and using string methods.
// - Template literals allow for multi-line strings and embedding expressions using `${}` syntax.   

// Example usage of different string operations:
let message = "Hello, JavaScript!";
console.log(message.length); // Output: 18
console.log(message.toUpperCase()); // Output: HELLO, JAVASCRIPT!
console.log(message.indexOf("Java")); // Output: 7
console.log(message.slice(7, 11)); // Output: Java
let newMessage = message.replace("JavaScript", "World");
console.log(newMessage); // Output: Hello, World!
let multiLineString = `This is a multi-line
string using template literals.`;   

console.log(multiLineString);
// Output:
// This is a multi-line
// string using template literals.  

// Summary:
// - Strings are sequences of characters used to represent text.
// - You can manipulate strings using various methods and operations.
// - Template literals provide enhanced functionality for working with strings.











// Boolean type

// In JavaScript, a boolean is a primitive data type that can have one of two values: true or false. Booleans are often used in conditional statements and logical operations to control the flow of a program. Here are some examples and operations you can perform with booleans in JavaScript:
// Declaring boolean variables
let isJavaScriptFun = true;
let isRaining = false;
console.log(isJavaScriptFun); // Output: true
console.log(isRaining); // Output: false    
// Boolean expressions
let a = 10;
let b = 5;
console.log(a > b); // Output: true
console.log(a < b); // Output: false
console.log(a === b); // Output: false
console.log(a !== b); // Output: true
// Logical operators
let isAdult = true;
let hasID = false;
console.log(isAdult && hasID); // Output: false
console.log(isAdult || hasID); // Output: true
console.log(!isAdult); // Output: false
// Conditional statements using booleans
if (isAdult) {  
    console.log("You are an adult.");
} else {
    console.log("You are not an adult.");
}
// Output: You are an adult.
// Summary:
// - Booleans can have two values: true or false.
// - They are commonly used in conditional statements and logical operations.
// - Logical operators include AND (&&), OR (||), and NOT (!).





// falsey values in JavaScript

// In JavaScript, "falsy" values are values that are considered false when evaluated in a boolean context. There are six falsy values in JavaScript:
// 1. false
// 2. 0 (zero)
// 3. "" (empty string)
// 4. null
// 5. undefined
// 6. NaN (Not-a-Number)

// Here are some examples of falsy values in JavaScript:
console.log(Boolean(false)); // Output: false
console.log(Boolean(0)); // Output: false
console.log(Boolean("")); // Output: false
console.log(Boolean(null)); // Output: false
console.log(Boolean(undefined)); // Output: false
console.log(Boolean(NaN)); // Output: false 

// You can use falsy values in conditional statements:
let value = 0;
if (!value) {
    console.log("The value is falsy.");
} else {
    console.log("The value is truthy.");
}   

// Output: The value is falsy.
// Summary:
// - Falsy values in JavaScript include false, 0, "", null, undefined, and NaN.
// - These values evaluate to false in boolean contexts, such as conditional statements.    











// Symbol type

// In JavaScript, a Symbol is a unique and immutable primitive data type that is often used as a key for object properties. Symbols are created using the `Symbol()` function and can have an optional description. Here are some examples and operations you can perform with Symbols in JavaScript:   

// Creating Symbols
let sym1 = Symbol();
let sym2 = Symbol("description");
console.log(sym1); // Output: Symbol()
console.log(sym2); // Output: Symbol(description)
console.log(typeof sym1); // Output: "symbol"

// Unique nature of Symbols
let symA = Symbol("key");
let symB = Symbol("key");
console.log(symA === symB); // Output: false (each Symbol is unique)
// Using Symbols as object keys
let myObject = {};
let symKey = Symbol("myKey");
myObject[symKey] = "Value associated with myKey";
console.log(myObject[symKey]); // Output: Value associated with myKey
// Symbols do not appear in for...in loops or Object.keys()
for (let key in myObject) {
    console.log(key); // No output
}

console.log(Object.keys(myObject)); // Output: []
// Retrieving Symbol keys using Object.getOwnPropertySymbols()
let symbolKeys = Object.getOwnPropertySymbols(myObject);
console.log(symbolKeys); // Output: [ Symbol(myKey) ]
// Summary:
// - Symbols are unique and immutable primitive data types.
// - They are often used as keys for object properties to avoid name collisions.
// - Symbols do not appear in standard property enumerations, but can be retrieved using Object.getOwnPropertySymbols().

// Example usage of Symbols:
let idSymbol = Symbol("id");
let user = {
    [idSymbol]: 12345,
    name: "John Doe"
};
console.log(user[idSymbol]); // Output: 12345
console.log(user.name); // Output: John Doe
// Summary:
// - Symbols provide a way to create unique property keys for objects.
// - They help prevent naming conflicts and enhance code maintainability.













// BigInt type

// In JavaScript, BigInt is a primitive data type that allows you to represent and manipulate integers with arbitrary precision. This means you can work with numbers larger than the maximum safe integer limit for the Number type (which is 2^53 - 1). BigInt values are created by appending an "n" to the end of an integer or by using the BigInt() constructor. Here are some examples and operations you can perform with BigInt in JavaScript:
// Creating BigInt values
let bigInt1 = 9007199254740991n; // Using the "n" suffix
let bigInt2 = BigInt("9007199254740992"); // Using the BigInt() constructor
console.log(bigInt1); // Output: 9007199254740991n
console.log(bigInt2); // Output: 9007199254740992n      

// Arithmetic operations with BigInt
let sum = bigInt1 + bigInt2;
let difference = bigInt2 - bigInt1;
let product = bigInt1 * 2n;
let quotient = bigInt2 / 2n;
console.log(sum); // Output: 18014398509481983n
console.log(difference); // Output: 1n
console.log(product); // Output: 18014398509481982n
console.log(quotient); // Output: 4503599627370496n
// Comparison operations with BigInt
console.log(bigInt1 < bigInt2); // Output: true 
console.log(bigInt1 === bigInt2); // Output: false
// Mixing BigInt and Number types
let num = 10;
let bigIntSum = bigInt1 + BigInt(num);
console.log(bigIntSum); // Output: 9007199254741001n
// Note: You cannot mix BigInt and Number types directly in arithmetic operations without explicit conversion.
// Summary:
// - BigInt allows for representation of integers with arbitrary precision.
// - Create BigInt values using the "n" suffix or the BigInt() constructor.
// - Perform arithmetic and comparison operations with BigInt values.
// - Avoid mixing BigInt and Number types directly in operations.

// Example usage of BigInt:
let largeNumber = 123456789012345678901234567890n;
let anotherLargeNumber = BigInt("987654321098765432109876543210");
let bigIntProduct = largeNumber * anotherLargeNumber;
console.log(bigIntProduct); // Output: 121932631137021795226185032733622923332237463801111263526900n
// Summary:
// - BigInt is useful for working with very large integers that exceed the limits of the Number type.
// - It provides a way to perform precise arithmetic operations on large numbers without losing accuracy.





// object type

// In JavaScript, an object is a non-primitive data type that represents a collection of key-value pairs. Objects are used to store and organize data, and they can contain properties (data) and methods (functions). Here are some examples and operations you can perform with objects in JavaScript:    

// Creating an object
let person = {
    name: "Alice",  
    age: 30,
    greet: function() {
        console.log("Hello, my name is " + this.name);
    }
};

console.log(person); // Output: { name: "Alice", age: 30, greet: [Function] }

// Accessing object properties
console.log(person.name); // Output: Alice
console.log(person["age"]); // Output: 30
// Calling object methods
person.greet(); // Output: Hello, my name is Alice
// Adding new properties to an object
person.city = "New York";
console.log(person.city); // Output: New York
// Updating existing properties
person.age = 31;
console.log(person.age); // Output: 31
// Deleting properties from an object
delete person.city;
console.log(person.city); // Output: undefined
// Iterating over object properties
for (let key in person) {
    console.log(key + ": " + person[key]);
}
// Output:
// name: Alice
// age: 31
// greet: function() { ... }
// Summary:
// - Objects are collections of key-value pairs used to store and organize data.
// - Access properties using dot notation or bracket notation.
// - Objects can have methods (functions) that operate on their data.
// - You can add, update, delete, and iterate over object properties.

// Example usage of objects:
let car = {
    make: "Toyota",
    model: "Camry",
    year: 2020,
    start: function() {
        console.log("The car has started.");
    }
};

console.log(car.make); // Output: Toyota
car.start(); // Output: The car has started.
// Summary:
// - Objects are versatile data structures in JavaScript that can hold various types of data and functionality.
// - They are essential for organizing and managing complex data in applications.


// Importatnt methods of objects

// Object.keys()
let sampleObject = { a: 1, b: 2, c: 3 };
let keys = Object.keys(sampleObject);
console.log(keys); // Output: ["a", "b", "c"]
// Object.values()
let values = Object.values(sampleObject);
console.log(values); // Output: [1, 2, 3]
// Object.entries()
let entries = Object.entries(sampleObject);
console.log(entries); // Output: [["a", 1], ["b", 2], ["c", 3]]
// Object.assign()
let target = { x: 1 };
let source = { y: 2, z: 3 };
Object.assign(target, source);
console.log(target); // Output: { x: 1, y: 2, z: 3 }
// Object.freeze()
let frozenObject = { p: 10, q: 20 };
Object.freeze(frozenObject);
frozenObject.p = 30; // This will not change the value
console.log(frozenObject.p); // Output: 10
// Summary:
// - Object.keys() returns an array of a given object's own enumerable property names.
// - Object.values() returns an array of a given object's own enumerable property values.
// - Object.entries() returns an array of a given object's own enumerable string-keyed property [key, value] pairs.
// - Object.assign() copies the values of all enumerable own properties from one or more source objects to a target object.
// - Object.freeze() freezes an object, preventing new properties from being added to it and marking all existing properties as read-only.



// when to use dot notation and bracket notation

// In JavaScript, you can access object properties using either dot notation or bracket notation. Here are the guidelines on when to use each:
// Dot Notation:
// - Use dot notation when the property name is a valid identifier (i.e., it starts with a letter, underscore, or dollar sign and contains only letters, digits, underscores, or dollar signs).
// - It is more concise and easier to read.

let person = { name: "John", age: 30 };
console.log(person.name); // Output: John
console.log(person.age); // Output: 30

// Bracket Notation:
// - Use bracket notation when the property name is not a valid identifier (e.g., it contains spaces, special characters, or starts with a digit).
// - It is also useful when the property name is stored in a variable.
let car = { "car model": "Toyota", "1stOwner": "Alice" };
console.log(car["car model"]); // Output: Toyota
console.log(car["1stOwner"]); // Output: Alice

let propertyName = "age";
console.log(person[propertyName]); // Output: 30
// Summary:
// - Use dot notation for valid identifiers for better readability.
// - Use bracket notation for property names that are not valid identifiers or when using variables to access properties.



// Example usage:
let book = {
    title: "JavaScript Basics",
    "publication year": 2021,
    author: "Jane Doe"
};

console.log(book.title); // Output: JavaScript Basics
console.log(book["publication year"]); // Output: 2021
console.log(book.author); // Output: Jane Doe

// Summary:
// - Dot notation is preferred for valid identifiers.
// - Bracket notation is necessary for non-standard property names or when using variables.

