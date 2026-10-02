// Javascript numberic separators

// In JavaScript, numeric separators (underscores) can be used to make large numbers more readable. They do not affect the actual value of the number. Here are some examples:  
// Using numeric separators in integers
let largeNumber = 1_000_000;
console.log(largeNumber); // Output: 1000000

// Using numeric separators in floating-point numbers
let preciseNumber = 3.141_592_653;
console.log(preciseNumber); // Output: 3.141592653
// Using numeric separators in binary, octal, and hexadecimal numbers
let binaryNumber = 0b1010_1011;
console.log(binaryNumber); // Output: 171

let octalNumber = 0o12_34;
console.log(octalNumber); // Output: 668
let hexNumber = 0xAB_CD_EF;
console.log(hexNumber); // Output: 11259375
// Summary:
// - Numeric separators (underscores) can be used in JavaScript to improve the readability of large numbers.
// - They can be placed between digits in integers, floating-point numbers, binary, octal, and hexadecimal representations.
// - Numeric separators do not affect the actual value of the number.











// Boolean data type in JavaScript represents one of two values: true or false. It is commonly used in conditional statements and logical operations. Here are some examples of how to work with boolean values in JavaScript:

// Declaring boolean variables
let isJavaScriptFun = true;
let isSkyGreen = false;

// functions provided by javascript to work with boolean values
console.log(Boolean(1)); // Output: true
console.log(Boolean(0)); // Output: false
console.log(Boolean("Hello")); // Output: true
console.log(Boolean("")); // Output: false  
console.log(Boolean(null)); // Output: false
console.log(Boolean(undefined)); // Output: false
console.log(Boolean(NaN)); // Output: false
console.log(Boolean([])); // Output: true
console.log(Boolean({})); // Output: true
console.log(Boolean(-5)); // Output: true

// Using boolean values in conditional statements   
if (isJavaScriptFun) {
    console.log("JavaScript is fun!"); // This will be printed
} else {
    console.log("JavaScript is not fun.");
}

if (isSkyGreen) {
    console.log("The sky is green.");
} else {
    console.log("The sky is not green."); // This will be printed
}

// Logical operations with boolean values
let a = true;
let b = false;

console.log(a && b); // Logical AND: Output: false
console.log(a || b); // Logical OR: Output: true
console.log(!a);     // Logical NOT: Output: false

// Summary:
// - Boolean data type represents true or false values.
// - It is commonly used in conditional statements and logical operations.
// - JavaScript provides the Boolean() function to convert values to boolean.













// all string functions in javascript
// In JavaScript, strings come with a variety of built-in functions (methods) that allow you to manipulate and work with string data. Here are some commonly used string functions:
let str = "Hello, World!";

// 1. length: Returns the length of the string
console.log(str.length); // Output: 13  
// 2. toUpperCase(): Converts the string to uppercase
console.log(str.toUpperCase()); // Output: "HELLO, WORLD!"
// 3. toLowerCase(): Converts the string to lowercase
console.log(str.toLowerCase()); // Output: "hello, world!"  
// 4. charAt(index): Returns the character at the specified index
console.log(str.charAt(7)); // Output: "W"  
// 5. indexOf(substring): Returns the index of the first occurrence of the specified substring
console.log(str.indexOf("World")); // Output: 7

// 6. substring(start, end): Extracts a substring from the string
console.log(str.substring(0, 5)); // Output: "Hello"  
// 7. replace(oldSubstring, newSubstring): Replaces the first occurrence of oldSubstring with newSubstring
console.log(str.replace("World", "JavaScript")); // Output: "Hello, JavaScript!"

// 8. split(separator): Splits the string into an array of substrings based on the specified separator
console.log(str.split(", "));
// Output: ["Hello", "World!"]  
// 9. trim(): Removes whitespace from both ends of the string
let strWithSpaces = "   Hello, World!   ";
console.log(strWithSpaces.trim()); // Output: "Hello, World!"  
// 10. includes(substring): Checks if the string contains the specified substring
console.log(str.includes("Hello")); // Output: true 
console.log(str.includes("Java")); // Output: false

// Summary:
// - JavaScript provides various built-in string functions to manipulate and work with string data.
// - Common functions include length, toUpperCase, toLowerCase, charAt, indexOf, substring, replace, split, trim, and includes.

// which function is applied on numbers to make the digits after decimal point to fixed value in string format
let num = 3.14159265359;
let fixedNum = num.toFixed(2);
console.log(fixedNum); // Output: "3.14"

// which function is applied on numbers to convert number to string
let num2 = 42;
let strNum = num2.toString();
console.log(strNum); // Output: "42"





//Object

// write all the functions of object in javascript with examples
let person = {
    firstName: "John",
    lastName: "Doe",
    age: 30,
    fullName: function() {
        return this.firstName + " " + this.lastName;
    }
};

// 1. Object.keys(): Returns an array of the object's own property names
console.log(Object.keys(person)); // Output: ["firstName", "lastName", "age", "fullName"]
// 2. Object.values(): Returns an array of the object's own property values
console.log(Object.values(person)); // Output: ["John", "Doe", 30, function]
// 3. Object.entries(): Returns an array of the object's own key-value pairs
console.log(Object.entries(person));
// Output: [["firstName", "John"], ["lastName", "Doe"], ["age", 30], ["fullName", function]]
// 4. hasOwnProperty(property): Checks if the object has the specified property
console.log(person.hasOwnProperty("age")); // Output: true
console.log(person.hasOwnProperty
("gender")); // Output: false
// 5. Object.assign(target, ...sources): Copies properties from source objects to the target object
let person2 = {};
Object.assign(person2, person);
console.log(person2);
// Output: {firstName: "John", lastName: "Doe", age: 30, fullName: function}
// 6. delete operator: Deletes a property from the object
delete person.age;
console.log(person);
// Output: {firstName: "John", lastName: "Doe", fullName: function}
// Summary:
// - JavaScript provides various built-in functions to work with objects.
// - Common functions include Object.keys, Object.values, Object.entries, hasOwnProperty, Object.assign, and the delete operator.



// Primitive vs. Reference Values
// In JavaScript, values can be categorized into two types: primitive values and reference values. Here are the key differences between them:

// 1. Primitive Values: 
// - Primitive values are basic data types that are not objects and have no methods.
// - They include: string, number, boolean, null, undefined, symbol, and bigint.
// - Primitive values are immutable, meaning they cannot be changed once created.
// - When you assign a primitive value to a variable, the variable holds the actual value.  














// comparing strings
let string1 = "apple";
let string2 = "banana";
console.log(string1 === string2); // Output: false
console.log(string1 !== string2); // Output: true
console.log(string1 < string2); // Output: true
console.log(string1 > string2); // Output: false
console.log(string1 <= string2); // Output: true
console.log(string1 >= string2); // Output: false

// Summary:
// - Strings can be compared using comparison operators (===, !==, <, >, <=, >=).
// - Comparisons are based on lexicographical (dictionary) order.
// - The result of a comparison is a boolean value (true or false).






// many ways to create string in javascript
// In JavaScript, there are several ways to create strings. Here are the most common methods:   

// 1. Using double quotes ("")
let str1 = "Hello, World!";
console.log(str1); // Output: Hello, World!
// 2. Using single quotes ('')
let str2 = 'Hello, World!';
console.log(str2);
    // Output: Hello, World!
// 3. Using backticks (``) - Template literals
let name = "Alice";
let str3 = `Hello, ${name}!`;
console.log(str3); // Output: Hello, Alice!
// 4. Using the String constructor
let str4 = new String("Hello, World!");
console.log(str4); // Output: [String: 'Hello, World!']
// Summary:
// - Strings can be created using double quotes, single quotes, backticks (template literals), or the String constructor.
// - Template literals allow for embedding expressions and multi-line strings using backticks.

// - Primitive values are stored directly in the variable.
let prim1 = 42;
let prim2 = prim1;
prim2 = 100;
console.log(prim1); // Output: 42
console.log(prim2); // Output: 100
// 2. Reference Values:
// - Reference values are objects and arrays.
// - They store a reference (memory address) to the actual data.
let ref1 = { name: "Alice" };
let ref2 = ref1;
ref2.name = "Bob";
console.log(ref1.name); // Output: Bob
console.log(ref2.name); // Output: Bob
// Summary:
// - Primitive values are immutable and stored directly in variables.
// - Reference values are mutable and stored as references to the actual data.
// - Changes to reference values affect all references to that value.

// Comparing Numbers
let num1 = 10;
let num2 = 20;
console.log(num1 === num2); // Output: false
console.log(num1 !== num2); // Output: true
console.log(num1 < num2); // Output: true
console.log(num1 > num2); // Output: false
console.log(num1 <= num2); // Output: true
console.log(num1 >= num2); // Output: false
// Summary:
// - Numbers can be compared using comparison operators (===, !==, <, >, <=, >=).
// - The result of a comparison is a boolean value (true or false).




// many ways to create objects in javascript
// In JavaScript, there are several ways to create objects. Here are the most common methods:
// 1. Using object literals
let obj1 = {
    name: "Alice",
    age: 25
};
console.log(obj1); // Output: { name: "Alice", age: 25 }
// 2. Using the Object constructor
let obj2 = new Object();

obj2.name = "Bob";
obj2.age = 30;
console.log(obj2); // Output: { name: "Bob", age: 30 }
// 3. Using a constructor function
function Person(name, age) {
    this.name = name;
    this.age = age;
}
let person1 = new Person("Charlie", 35);
console.log(person1); // Output: Person { name: "Charlie", age: 35 }
// 4. Using Object.create()
let proto = {
    greet: function() {
        console.log("Hello, " + this.name);
    }
};

let obj3 = Object.create(proto);
obj3.name = "David";
obj3.greet(); // Output: Hello, David
// Summary:
// - Objects can be created using object literals, the Object constructor, constructor functions, or Object.create().
// - Each method has its own use cases and advantages depending on the situation.   

// Comparing Booleans
let bool1 = true;
let bool2 = false;
console.log(bool1 === bool2); // Output: false
console.log(bool1 !== bool2); // Output: true
console.log(bool1 && bool2); // Output: false
console.log(bool1 || bool2); // Output: true
console.log(!bool1); // Output: false
console.log(!bool2); // Output: true
// Summary:
// - Booleans can be compared using comparison operators (===, !==) and logical operators (&&, ||, !).
// - The result of a comparison or logical operation is a boolean value (true or false).




// checking if a property exists in an object
let car = {
    make: "Toyota",
    model: "Camry",
    year: 2020
};
console.log("model" in car); // Output: true
console.log("color" in car); // Output: false
// Summary:
// - You can check if a property exists in an object using the `in` operator.
// - The result is a boolean value (true or false).




// primitive values in javascript
// In JavaScript, primitive values are the most basic data types that are not objects and have no methods. There are six primitive data types in JavaScript:    
// 1. String: Represents a sequence of characters
let str = "Hello, World!";  
console.log(str); // Output: Hello, World!
// 2. Number: Represents both integer and floating-point numbers
let num = 42;   
console.log(num); // Output: 42
// 3. Boolean: Represents a logical entity that can be either true or false
let bool = true;
console.log(bool); // Output: true
// 4. Null: Represents the intentional absence of any object value
let emptyValue = null;
console.log(emptyValue); // Output: null
// 5. Undefined: Represents a variable that has been declared but not assigned a value
let undefinedValue;
console.log(undefinedValue); // Output: undefined
// 6. Symbol: Represents a unique and immutable identifier
let sym = Symbol("unique");
console.log(sym); // Output: Symbol(unique)
// Summary:
// - Primitive values are the most basic data types in JavaScript.
// - They include String, Number, Boolean, Null, Undefined, and Symbol.
// - Primitive values are immutable and do not have methods.



// reference values in javascript
// In JavaScript, reference values are objects and arrays that store a reference (memory address) to the actual data. Here are some examples of reference values:    
// 1. Object: A collection of key-value pairs
let obj = {
    name: "Alice",
    age: 25
};
console.log(obj); // Output: { name: "Alice", age: 25 }
// 2. Array: An ordered collection of values
let arr = [1, 2, 3, 4, 5];
console.log(arr); // Output: [1, 2, 3, 4, 5]
// 3. Function: A block of code designed to perform a particular task
function greet(name) {
    return "Hello, " + name + "!";
}
console.log(greet("Alice")); // Output: Hello, Alice!

// Summary:
// - Reference values are objects, arrays, and functions in JavaScript.
// - They store a reference to the actual data rather than the data itself.
// - Changes to reference values affect all references to that value.

// Comparing Arrays
let arr1 = [1, 2, 3];
let arr2 = [1, 2, 3];
console.log(arr1 === arr2); // Output: false
console.log(arr1 !== arr2); // Output: true
let arr3 = arr1;
console.log(arr1 === arr3); // Output: true
console.log(arr1 !== arr3); // Output: false
// Summary:
// - Arrays are compared by reference, not by their content.
// - Two different arrays with the same content are not considered equal.
// - Only references to the same array are considered equal.    

// Comparing Objects
let objA = { key: "value" };
let objB = { key: "value" };
console.log(objA === objB); // Output: false
console.log(objA !== objB); // Output: true
let objC = objA;
console.log(objA === objC); // Output: true
console.log(objA !== objC); // Output: false
// Summary:
// - Objects are compared by reference, not by their content.
// - Two different objects with the same properties are not considered equal.
// - Only references to the same object are considered equal.

// Comparing Functions
function func1() {
    return "Hello";
}
function func2() {
    return "Hello";
}
console.log(func1 === func2); // Output: false
console.log(func1 !== func2); // Output: true
let func3 = func1;
console.log(func1 === func3); // Output: true
console.log(func1 !== func3); // Output: false
// Summary:
// - Functions are compared by reference, not by their content.
// - Two different functions with the same implementation are not considered equal.
// - Only references to the same function are considered equal. 

// Comparing Null and Undefined
let val1 = null;
let val2 = undefined;
console.log(val1 === val2); // Output: false
console.log(val1 !== val2); // Output: true
let val3 = null;
console.log(val1 === val3); // Output: true
console.log(val1 !== val3); // Output: false
// Summary:
// - Null and undefined are distinct types and values.
// - They are not strictly equal to each other.
// - Only references to the same null or undefined value are considered equal.  

// Comparing Symbol Values
let sym1 = Symbol("desc");
let sym2 = Symbol("desc");
console.log(sym1 === sym2); // Output: false
console.log(sym1 !== sym2); // Output: true
let sym3 = sym1;
console.log(sym1 === sym3); // Output: true
console.log(sym1 !== sym3); // Output: false
// Summary:
// - Symbol values are unique and immutable.
// - Two different symbols with the same description are not considered equal.
// - Only references to the same symbol are considered equal.

// Comparing BigInt Values
let bigInt1 = BigInt(9007199254741991);
let bigInt2 = BigInt(9007199254741991);
console.log(bigInt1 === bigInt2); // Output: true
console.log(bigInt1 !== bigInt2); // Output: false
let bigInt3 = bigInt1;
console.log(bigInt1 === bigInt3); // Output: true
console.log(bigInt1 !== bigInt3); // Output: false
// Summary:
// - BigInt values can be compared using comparison operators (===, !==).
// - Two BigInt values with the same numeric value are considered equal.

// Comparing Mixed Types
let mixed1 = 42;
let mixed2 = "42";
console.log(mixed1 === mixed2); // Output: false
console.log(mixed1 !== mixed2); // Output: true
console.log(mixed1 == mixed2); // Output: true
console.log(mixed1 != mixed2); // Output: false
// Summary:
// - Mixed types can be compared using both strict (===, !==) and loose (==, !=) comparison operators.
// - Strict comparison checks both value and type, while loose comparison performs type coercion.
// - Be cautious when comparing mixed types to avoid unexpected results.    




// role of stack and heap memory in primitive and reference values
// In JavaScript, memory management for primitive and reference values involves two main areas: stack memory and heap memory. Here's how they play a role in storing these values:
// 1. Stack Memory:
// - Stack memory is used to store primitive values (string, number, boolean, null, undefined, symbol, bigint).
// - Primitive values are stored directly in the stack memory, which allows for fast access and efficient memory usage.

let primA = 42; // Stored in stack memory
let primB = primA;
primB = 100;
console.log(primA); // Output: 42
console.log(primB); // Output: 100
// 2. Heap Memory:
// - Heap memory is used to store reference values (objects, arrays, functions).
// - Reference values are stored in heap memory, and the variable holds a reference (memory address) to the actual data in the heap.

let refA = { name: "Alice" }; // Stored in heap memory
let refB = refA;
refB.name = "Bob";
console.log(refA.name); // Output: Bob
console.log(refB.name); // Output: Bob
// Summary:
// - Primitive values are stored in stack memory, allowing for fast access and efficient memory usage.
// - Reference values are stored in heap memory, with variables holding references to the actual data.
// - Changes to reference values affect all references to that value, while primitive values are independent.   
let person = {
    name: "John",
    age: 30
};
console.log(person); // Output: { name: "John", age: 30 }
person.age = 31;
console.log(person); // Output: { name: "John", age: 31 }


// In this example, the `person` object is stored in heap memory, and both `person` and any other variable referencing it point to the same memory location. Changes made through one reference are reflected in all references.

// Summary:
// - Stack memory is used for primitive values, while heap memory is used for reference values.
// - Primitive values are stored directly in stack memory, while reference values store a reference to the data in heap memory.
// - Understanding the role of stack and heap memory helps in managing memory effectively in JavaScript.







// is heap data structure is same as heap memory in javascript
// No, heap data structure and heap memory in JavaScript are not the same thing. They refer to different concepts:
// 1. Heap Data Structure:
// - A heap data structure is a specialized tree-based data structure that satisfies the heap property. In a max-heap, for example, the value of each parent node is greater than or equal to the values of its child nodes. In a min-heap, the value of each parent node is less than or equal to the values of its child nodes.
// - Heaps are commonly used to implement priority queues and for efficient sorting algorithms like heapsort.
// 2. Heap Memory in JavaScript:
// - Heap memory in JavaScript refers to the area of memory used for dynamic memory allocation, where objects, arrays, and functions (reference values) are stored.
// - When you create an object or array in JavaScript, it is allocated in heap memory, and variables hold references to these memory locations.
// Summary:
// - Heap data structure is a specific type of data structure used for organizing data based on the heap property.
// - Heap memory in JavaScript is a memory area used for storing reference values like objects and arrays.
// - They are distinct concepts and serve different purposes in programming and memory management.
// Example of Heap Data Structure (Max-Heap)
class MaxHeap {
    constructor() {
        this.heap = [];
    }   
    insert(value) {
        this.heap.push(value);
        this.bubbleUp();
    }
    bubbleUp() {
        let index = this.heap.length - 1;
        while (index > 0) {
            let parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[index] <= this.heap[parentIndex]) break;
            [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
            index = parentIndex;
        }
    }
    extractMax() {
        if (this.heap.length === 0) return null;
        if (this.heap.length === 1) return this.heap.pop();
        const max = this.heap[0];
        this.heap[0] = this.heap.pop();
        this.bubbleDown();
        return max;
    }
    bubbleDown() {
        let index = 0;
        const length = this.heap.length;
        while (true) {
            let leftChildIndex = 2 * index + 1;
            let rightChildIndex = 2 * index + 2;
            let largest = index;    
            if (leftChildIndex < length && this.heap[leftChildIndex] > this.heap[largest]) {
                largest = leftChildIndex;
            }
            if (rightChildIndex < length && this.heap[rightChildIndex] > this.heap[largest]) {
                largest = rightChildIndex;
            }
            if (largest === index) break;
            [this.heap[index], this.heap[largest]] = [this.heap[largest], this.heap[index]];
            index = largest;
        }
    }
}

// Example usage of MaxHeap
let maxHeap = new MaxHeap();
maxHeap.insert(10);
maxHeap.insert(20);
maxHeap.insert(5);
console.log(maxHeap.extractMax()); // Output: 20
console.log(maxHeap.extractMax()); // Output: 10
console.log(maxHeap.extractMax()); // Output: 5
// In this example, we define a MaxHeap class that implements a max-heap data structure with methods to insert values and extract the maximum value. This is different from heap memory in JavaScript, which is used for storing reference values like objects and arrays.
// Summary:
// - The MaxHeap class demonstrates a heap data structure with methods for insertion and extraction.
// - Heap memory in JavaScript is used for storing reference values, while heap data structures are used for organizing data based on specific properties.
// - They are distinct concepts with different purposes in programming and memory management.


// if heap data structure is not same as heap memory then why is it called heap memory
// The term "heap memory" in programming languages like JavaScript is derived from the concept of dynamic memory allocation, where memory is allocated and deallocated in a non-contiguous manner. The term "heap" in this context does not directly refer to the heap data structure but rather to the idea of a large pool of memory that can be used for dynamic allocation.
// Here are a few reasons why it is called "heap memory":
// 1. Dynamic Allocation: Heap memory allows for dynamic allocation of memory at runtime, meaning that memory can be requested and released as needed. This is in contrast to stack memory, which is used for static allocation of local variables.
// 2. Non-Contiguous Memory: Heap memory is typically non-contiguous, meaning that allocated memory blocks can be scattered throughout the memory space. This allows for more flexible memory usage compared to stack memory, which is contiguous and follows a last-in-first-out (LIFO) order.
// 3. Historical Context: The term "heap" has been used in computer science for decades to describe a region of memory used for dynamic allocation. The terminology has persisted even though the underlying implementation may not use a heap data structure.
// Summary:
// - Heap memory refers to a region of memory used for dynamic allocation, not the heap data structure.
// - It allows for flexible and non-contiguous memory allocation at runtime.
// - The term "heap" has historical roots in computer science and has been adopted to describe this type of memory management.
// In summary, while heap memory and heap data structures share the same name, they refer to different concepts in programming. Heap memory is about dynamic memory allocation, while heap data structures are specific ways of organizing data based on certain properties.    











// what is the difference between stack memory and heap memory in javascript
// In JavaScript, stack memory and heap memory are two distinct areas of memory used for different purposes. Here are the key differences between them:
// 1. Stack Memory: 
// - Stack memory is used for static memory allocation, which includes storing primitive values (string, number, boolean, null, undefined, symbol, bigint) and function call information.
// - It operates in a last-in-first-out (LIFO) manner, meaning that the most recently added data is the first to be removed.
// - Stack memory is faster to access and manage due to its structured nature.
// - The size of stack memory is limited, and excessive use can lead to stack overflow errors.
// 2. Heap Memory:
// - Heap memory is used for dynamic memory allocation, which includes storing reference values (objects, arrays, functions).
// - It allows for more flexible memory usage, as memory blocks can be allocated and deallocated in a non-contiguous manner.
// - Heap memory is generally slower to access compared to stack memory due to its dynamic nature.
// - The size of heap memory is larger and can grow as needed, but it requires garbage collection to manage unused memory.
// Summary:
// - Stack memory is used for static allocation of primitive values and function calls, while heap memory is used for dynamic allocation of reference values.
// - Stack memory operates in a LIFO manner and is faster to access, while heap memory allows for flexible memory usage but is slower to access.
// - Stack memory has size limitations, while heap memory can grow as needed but requires garbage collection for management.
// Example of Stack Memory Usage
function add(a, b) {
    return a + b;
}
let result = add(5, 10);
console.log(result); // Output: 15
// In this example, the function `add` and its parameters `a` and `b` are stored in stack memory during the function call. Once the function execution is complete, the stack memory used for the function call is released.

// Example of Heap Memory Usage
let person = {
    name: "Alice",
    age: 25
};
console.log(person); // Output: { name: "Alice", age: 25 }
// In this example, the `person` object is stored in heap memory, and the variable `person` holds a reference to that memory location. Changes made to the object through the `person` variable will affect the data stored in heap memory.
// Summary:
// - Stack memory is used for function calls and primitive values, while heap memory is used for objects and arrays.
// - Understanding the differences between stack and heap memory helps in optimizing memory usage and performance in JavaScript applications.