// how memory allocation and deallocation works in javascript compilation of a javascript file

// In JavaScript, memory allocation and deallocation are managed automatically through a process called garbage collection. Here's a brief overview of how it works:    
// 1. Memory Allocation:
// When you create variables, objects, or arrays in JavaScript, memory is allocated for them in the heap (a region of memory used for dynamic memory allocation). For example:
let obj = { name: "John", age: 30 }; // Memory is allocated for the object
let arr = [1, 2, 3, 4, 5]; // Memory is allocated for the array 
let str = "Hello, World!"; // Memory is allocated for the string

// 2. Memory Deallocation:
// JavaScript uses a garbage collector to automatically manage memory deallocation. The garbage collector periodically checks for objects that are no longer reachable or referenced in the code. When it finds such objects, it frees up the memory they occupied. For example:
obj = null; // The object is no longer referenced
arr = null; // The array is no longer referenced
str = null; // The string is no longer referenced

// At this point, the garbage collector will eventually reclaim the memory used by the object, array, and string since there are no references to them anymore.
// 3. How Garbage Collection Works:
// JavaScript primarily uses a technique called "mark-and-sweep" for garbage collection. Here's how it works:
// - Marking Phase: The garbage collector starts from the root objects (global objects, local variables in functions, etc.) and marks all reachable objects by following references.
// - Sweeping Phase: After marking, the garbage collector goes through the memory and deallocates any objects that were not marked as reachable.
// Summary:
// - Memory allocation in JavaScript is automatic when you create variables, objects, or arrays.
// - Memory deallocation is handled by the garbage collector, which frees up memory occupied by objects that are no longer reachable.
// - The mark-and-sweep algorithm is commonly used for garbage collection in JavaScript.







// simple definition of array in javascript

// An array in JavaScript is a special type of object that is used to store multiple values in a single variable. Arrays can hold values of different data types, including numbers, strings, objects, and even other arrays. Here are some key points about arrays in JavaScript:
// 1. Declaration: You can declare an array using square brackets [] or the Array constructor.
let fruits = ["Apple", "Banana", "Orange"];

let numbers = new Array(1, 2, 3, 4, 5);

// 2. Accessing Elements: You can access array elements using their index, which starts from 0.
console.log(fruits[0]); // Output: Apple
console.log(numbers[2]); // Output: 3

// 3. Array Length: You can get the number of elements in an array using the length property.
console.log(fruits.length); // Output: 3
console.log(numbers.length); // Output: 5
// 4. Modifying Elements: You can modify elements in an array by assigning a new value to a specific index.
fruits[1] = "Mango";
console.log(fruits); // Output: ["Apple", "Mango", "Orange"]
numbers[0] = 10;
console.log(numbers); // Output: [10, 2, 3, 4, 5]
// 5. Array Methods: JavaScript provides various built-in methods to manipulate arrays, such as push, pop, shift, unshift, splice, slice, and more.
fruits.push("Grapes"); // Adds "Grapes" to the end of the array
console.log(fruits); // Output: ["Apple", "Mango", "Orange", "Grapes"]  
numbers.pop(); // Removes the last element from the array
console.log(numbers); // Output: [10, 2, 3, 4]
// Summary:
// - An array is a special type of object used to store multiple values.
// - Arrays can hold different data types and are declared using square brackets or the Array constructor.
// - You can access, modify, and manipulate array elements using their index and various built-in methods.



// ways of creating array in javascript

// In JavaScript, there are several ways to create an array. Here are some of the most common methods:
// 1. Using Array Literal Notation:
let fruits = ["Apple", "Banana", "Orange"];
console.log(fruits); // Output: ["Apple", "Banana", "Orange"]
// 2. Using the Array Constructor:
let numbers = new Array(1, 2, 3, 4, 5);
console.log(numbers); // Output: [1, 2, 3, 4, 5]
// 3. Using Array.of() Method:
let colors = Array.of("Red", "Green", "Blue");
console.log(colors); // Output: ["Red", "Green", "Blue"]
// 4. Using Array.from() Method:
let str = "Hello";
let chars = Array.from(str);
console.log(chars); // Output: ["H", "e", "l", "l", "o"]
// 5. Using Spread Operator:
let moreFruits = [...fruits, "Grapes", "Mango"];
console.log(moreFruits); // Output: ["Apple", "Banana", "Orange", "Grapes", "Mango"]
// Summary:
// - You can create arrays using array literal notation, the Array constructor, Array.of(), Array.from(), and the spread operator.
// - Each method has its own use cases and advantages depending on the situation.
// 6. Using the fill() Method:
let filledArray = new Array(5).fill(0);
console.log(filledArray); // Output: [0, 0, 0, 0, 0]
// Summary:
// - The fill() method creates an array of a specified length and fills it with a static value. 
// - This is useful for initializing arrays with default values.
// 7. Using the Array.from() Method with a Mapping Function:
let squares = Array.from({ length: 5 }, (v, i) => i * i);
console.log(squares); // Output: [0, 1, 4, 9, 16]
// Summary:
// - The Array.from() method can also take a mapping function as its second argument to create arrays based on specific transformations or calculations.
// - This is useful for generating arrays with computed values based on their indices.
// 8. Using the Array Constructor with a Single Numeric Argument:
let emptyArray = new Array(3);
console.log(emptyArray); // Output: [ <3 empty items> ]
// Summary:
// - When the Array constructor is called with a single numeric argument, it creates an array with that length but does not initialize the elements.
// - This can be useful when you want to create an empty array of a specific size to be filled later.





// check if a value is an array in javascript

// In JavaScript, you can check if a value is an array using the Array.isArray() method. This method returns true if the value is an array and false otherwise. Here are some examples:
let fruits = ["Apple", "Banana", "Orange"];
let number = 42;
let obj = { name: "John" };
console.log(Array.isArray(fruits)); // Output: true
console.log(Array.isArray(number)); // Output: false
console.log(Array.isArray(obj)); // Output: false
// You can also use the instanceof operator to check if a value is an array:
console.log(fruits instanceof Array); // Output: true   

console.log(number instanceof Array); // Output: false

console.log(obj instanceof Array); // Output: false
// Summary:
// - Use Array.isArray() to check if a value is an array.
// - Alternatively, you can use the instanceof operator to perform the same check.
// - Both methods are effective for determining if a value is an array in JavaScript.







// push, pop, map, filter, reduce, length, unshift, shift, foreach, slice, splice, indexof, includes, concat, join, toString, sort, reverse, etc methods of array in javascript
// JavaScript arrays come with a variety of built-in methods that allow you to manipulate and work with array data. Here are some commonly used array methods along with examples:
let numbers = [1, 2, 3, 4, 5];
// push() - Adds one or more elements to the end of an array
numbers.push(6);
console.log(numbers); // Output: [1, 2, 3, 4, 5, 6]
// pop() - Removes the last element from an array
numbers.pop();
console.log(numbers); // Output: [1, 2, 3, 4, 5]

// map() - Creates a new array with the results of calling a provided function on every element
let doubled = numbers.map(num => num * 2);
console.log(doubled); // Output: [2, 4, 6, 8, 10]
// filter() - Creates a new array with all elements that pass the test implemented by the provided function
let evenNumbers = numbers.filter(num => num % 2 === 0);
console.log(evenNumbers); // Output: [2, 4]
// reduce() - Executes a reducer function on each element, resulting in a single output value
let sum = numbers.reduce((acc, curr) => acc + curr, 0);
console.log(sum); // Output: 15
// length - Returns the number of elements in an array
console.log(numbers.length); // Output: 5
// unshift() - Adds one or more elements to the beginning of an array
numbers.unshift(0);
console.log(numbers); // Output: [0, 1, 2, 3, 4, 5]
// shift() - Removes the first element from an array
numbers.shift();
console.log(numbers); // Output: [1, 2, 3, 4, 5]
// forEach() - Executes a provided function once for each array element
numbers.forEach(num => console.log(num));
// Output: 1 2 3 4 5
// slice() - Returns a shallow copy of a portion of an array into a new array
let sliced = numbers.slice(1, 4);
console.log(sliced); // Output: [2, 3, 4]
// splice() - Changes the contents of an array by removing or replacing existing elements and/or adding new elements
numbers.splice(2, 1, 10); // Removes 1 element at index 2 and adds 10
console.log(numbers); // Output: [1, 2, 10, 4, 5]
// indexOf() - Returns the first index at which a given element can be found
console.log(numbers.indexOf(10)); // Output: 2
// includes() - Determines whether an array includes a certain element
console.log(numbers.includes(4)); // Output: true
// concat() - Merges two or more arrays
let moreNumbers = [6, 7, 8];
let combined = numbers.concat(moreNumbers);
console.log(combined); // Output: [1, 2, 10, 4, 5, 6, 7, 8]
// join() - Joins all elements of an array into a string
let joined = numbers.join(", ");
console.log(joined); // Output: "1, 2, 10, 4, 5"
// toString() - Converts an array to a string
console.log(numbers.toString());
// Output: "1,2,10,4,5"
// sort() - Sorts the elements of an array in place and returns the sorted array
numbers.sort((a, b) => a - b);
console.log(numbers); // Output: [1, 2, 4, 5, 10]
// reverse() - Reverses the order of the elements in an array
numbers.reverse();
console.log(numbers); // Output: [10, 5, 4, 2, 1]
// Summary:
// - JavaScript arrays come with a variety of built-in methods for manipulation and data processing.
// - Common methods include push, pop, map, filter, reduce, length, unshift, shift, forEach, slice, splice, indexOf, includes, concat, join, toString, sort, and reverse.
// - These methods help you perform various operations on arrays efficiently.


