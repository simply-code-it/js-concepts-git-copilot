// To define a variable in JavaScript, you can use the `var`, `let`, or `const` keywords. Here are examples of each:

// Using var
var name = "Alice";
console.log(name); // Output: Alice

// Using let
let age = 30;
console.log(age); // Output: 30

// Using const
const country = "USA";
console.log(country); // Output: USA    

// Note:
// - `var` is function-scoped and can be redeclared and updated.
// - `let` is block-scoped and can be updated but not redeclared within the same scope.
// - `const` is block-scoped and cannot be updated or redeclared; it must be initialized at the time of declaration.    

// Example of updating and redeclaring variables
var city = "New York";
city = "Los Angeles";   

console.log(city); // Output: Los Angeles

let state = "California";
state = "Texas";
console.log(state); // Output: Texas

// const country = "Canada"; // This will throw an error because country is already declared as const   
// country = "Mexico"; // This will also throw an error because const variables cannot be reassigned

// Summary:
// Use `var` for function-scoped variables, `let` for block-scoped variables that may change, and `const` for block-scoped variables that should remain constant.   


// To declare a function, you can use the `function` keyword followed by the function name and parentheses. Here are some examples:

// The following example defines a function that calculates the sum of two numbers:
function sum(a, b) {
    return a + b;
}   

// You can call the function and pass arguments to it:
let result = sum(5, 10);
console.log(result); // Output: 15

// Javascript provides you with condition statements such as if-else and switch statements. Here are examples of each:

// Using if-else statement
let number = 10;   
if (number > 0) {
    console.log("The number is positive.");
} else if (number < 0) {
    console.log("The number is negative.");
}   
else {
    console.log("The number is zero.");
}

// write a function divide for above number
function divide(a, b) {
    if (b === 0) {
        return "Error: Division by zero is not allowed.";
    } else {
        return a / b;
    }
}   

let divisionResult = divide(10, 2);
console.log(divisionResult); // Output: 5

//  To declare an array in JavaScript, you can use square brackets [] and separate the elements with commas. Here are some examples:
let fruits = ["Apple", "Banana", "Orange"];
console.log(fruits); // Output: ["Apple", "Banana", "Orange"]   

let numbers = [1, 2, 3, 4, 5];
console.log(numbers); // Output: [1, 2, 3, 4, 5]        

// You can access array elements using their index (starting from 0):
console.log(fruits[0]); // Output: Apple
console.log(numbers[2]); // Output: 3


// To iterate over the elements of an array, you can use a for loop or the forEach method. Here are examples of each:

// Using a for loop
for (let i = 0; i < fruits.length; i++) {
    console.log(fruits[i]);
}   

// Using forEach method
fruits.forEach(function(fruit) {
    console.log(fruit);
});

// Both methods will output:
// Apple
// Banana
// Orange   

// Alternatively , you can use a for...of loop to iterate over array elements:
for (let fruit of fruits) {
    console.log(fruit);
}   

// This will also output:
// Apple
// Banana
// Orange

// Summary:
// - Declare arrays using square brackets [].
// - Access elements using their index.
// - Iterate over arrays using for loops, forEach method, or for...of loops.    

// To create an object in JavaScript, you can use curly braces {} and define key-value pairs. Here are some examples:
let person = {
    name: "John",
    age: 25,
    city: "New York"
};

console.log(person); // Output: { name: "John", age: 25, city: "New York" }

// You can access object properties using dot notation or bracket notation:
console.log(person.name); // Output: John
console.log(person["age"]); // Output: 25   

// You can also add, update, or delete properties of an object:
// Adding a new property
person.country = "USA"
console.log(person.country); // Output: USA
// Updating an existing property
person.age = 26;
console.log(person.age); // Output: 26
// Deleting a property
delete person.city;
console.log(person); // Output: { name: "John", age: 26, country: "USA" }   

// To iterate over the properties of an object, you can use a for...in loop. Here is an example:
for (let key in person) {
    console.log(key + ": " + person[key]);
}
// This will output:
// name: John
// age: 26
// country: USA

// Summary:
// - Create objects using curly braces {} with key-value pairs.
// - Access properties using dot notation or bracket notation.
// - Add, update, or delete properties as needed.
// - Iterate over properties using a for...in loop. 

// To handle errors in JavaScript, you can use the `try...catch` statement. Here is an example:
try {
    // Code that may throw an error 
    let result = 10 / 0;
    if (!isFinite(result)) {
        throw new Error("Division by zero is not allowed.");
    }   
    console.log("Result: " + result);
} catch (error) {
    // Code to handle the error
    console.log("Error: " + error.message);
}   

// In this example, the code inside the `try` block attempts to divide a number by zero. Since this operation is not allowed, an error is thrown using the `throw` statement. The `catch` block then catches the error and logs an error message to the console.

// You can also use the `finally` block to execute code that should run regardless of whether an error occurred or not. Here is an example:

try {
    // Code that may throw an error
    let data = JSON.parse('{"name": "Alice", "age": 30}');
    console.log("Data: ", data);
}   catch (error) {
    // Code to handle the error
    console.log("Error: " + error.message);
} finally {
    // Code that will always run
    console.log("Execution completed.");
}   

// In this example, the `finally` block will always execute after the `try` and `catch` blocks, regardless of whether an error occurred or not.

// Summary:
// - Use `try` to wrap code that may throw an error.
// - Use `catch` to handle the error if it occurs.
// - Optionally, use `finally` to execute code that should run regardless of errors.

