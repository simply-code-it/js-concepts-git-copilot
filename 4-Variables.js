// Variable in javascript

// A variable is a named storage location in JavaScript that holds a value. Variables are used to store data that can be referenced and manipulated throughout your code. In JavaScript, you can declare variables using the keywords `var`, `let`, or `const`. Here are some examples of how to declare and use variables in JavaScript:

// Using var (function-scoped variable)
var name = "Alice";
console.log(name); // Output: Alice



// By default, a variable has a special value called `undefined` until you assign a value to it. For example:   

var age;
console.log(age); // Output: undefined
age = 25;
console.log(age); // Output: 25

/*

In JavaScript, variable names follow these rules:

Variable names are case-sensitive. This means that the message and Message are different variables.
Variable names can only contain letters, numbers, underscores, or dollar signs and cannot contain spaces. Also, variable names must begin with a letter, an underscore (_) or a dollar sign ($).
Variable names cannot use the reserved words.

*/


// Javascript is a dynamically typed language, which means you don't have to specify the data type of a variable when you declare it. The data type is determined automatically based on the value assigned to the variable. For example:
let score = 100; // score is a number
console.log(score); // Output: 100

score = "One Hundred"; // Now score is a string
console.log(score); // Output: One Hundred

// Summary:
// - A variable is a named storage location for data.
// - Use `var`, `let`, or `const` to declare variables.
// - Variables can hold different data types and can be reassigned (except for `const`).
// - Variable names must follow specific rules regarding characters and case sensitivity.



// Difference between var, let and const

// In JavaScript, there are three keywords used to declare variables: `var`, `let`, and `const`. Each has its own characteristics and use cases. Here are the key differences between them:

// 1. Scope:
// - `var` is function-scoped, meaning it is accessible within the function it is declared in.
// - `let` and `const` are block-scoped, meaning they are only accessible within the block (enclosed by curly braces {}) they are declared in.

// 2. Re-declaration:
// - `var` allows re-declaration of the same variable within the same scope.
// - `let` and `const` do not allow re-declaration within the same scope.

// 3. Re-assignment:
// - `var` and `let` allow re-assignment of values to the variable.
// - `const` does not allow re-assignment; the value must be assigned at the time of declaration and cannot be changed later.

// Examples:

// Using var
function varExample() {
    var x = 10;
    console.log(x); // Output: 10
    {
        var x = 20; // Re-declaration allowed
        console.log(x); // Output: 20
    }
}

varExample();

// Using let
function letExample() {
    let y = 10;
    console.log(y); // Output: 10
    {
        let y = 20; // Different variable in block scope
        console.log(y); // Output: 20
    }
}

letExample();

// Using const

function constExample() {
    const z = 10;
    console.log(z); // Output: 10
    // z = 20; // This will throw an error because const cannot be reassigned
}

constExample();

// Summary:
// - Use `var` for function-scoped variables that may need to be re-declared.
// - Use `let` for block-scoped variables that may change.
// - Use `const` for block-scoped variables that should remain constant and not be reassigned.




// Undefined vs Undeclared variables

// In JavaScript, "undefined" and "undeclared" refer to two different concepts related to variables:    
// 1. Undefined Variable:
// An undefined variable is a variable that has been declared but has not been assigned a value. When you try to access an undefined variable, it returns the special value `undefined`. For example:
let a;
console.log(a); // Output: undefined

// 2. Undeclared Variable:
// An undeclared variable is a variable that has not been declared at all using `var`, `let`, or `const`. If you try to access an undeclared variable, it results in a ReferenceError. For example:
try {
    console.log(b); // This will throw a ReferenceError
} catch (error) {
    console.log(error.message); // Output: b is not defined
}

// Summary:
// - An undefined variable is declared but has no value assigned, resulting in the value `undefined`.
// - An undeclared variable has not been declared at all, leading to a ReferenceError when accessed.













// Constants in javascript
// In JavaScript, a constant is a variable that is declared using the `const` keyword. Once a constant is assigned a value, it cannot be reassigned or changed. Constants are block-scoped, meaning they are only accessible within the block (enclosed by curly braces {}) they are declared in. Here are some examples of how to declare and use constants in JavaScript:

// Using const (block-scoped, constant)
const country = "USA";
console.log(country); // Output: USA
// country = "Canada"; // This will throw an error because const variables cannot be reassigned

// Summary:
// - Use const for block-scoped variables that should remain constant.
// - Constants must be assigned a value at the time of declaration and cannot be changed later.



/*

Summary
A variable is a label that references a value.
Use the let keyword to declare a variable.
An undefined variable is a variable that has been declared but not initialized while an undeclared variable is a variable that has not been declared.
Use the const keyword to define a readonly reference to a value.

*/