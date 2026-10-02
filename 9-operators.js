// JavaScript Operators, Arithmetic Operators,Remainder Operator, Assignment Operators, Unary Operators, Comparison Operators, Logical Operators

// Arithmetic Operators
let x = 10;
let z = 3;
let addition = x + z; // Addition
let subtraction = x - z; // Subtraction
let multiplication = x * z; // Multiplication
let division = x / z; // Division
let modulus = x % z; // Remainder
console.log("Addition: " + addition); // Output: 13
console.log("Subtraction: " + subtraction); // Output: 7
console.log("Multiplication: " + multiplication); // Output: 30
console.log("Division: " + division); // Output: 3.3333333333333335
console.log("Modulus: " + modulus); // Output: 1

// Assignment Operators
let a = 5;
a += 3; // Equivalent to a = a + 3
console.log("a after += 3: " + a); // Output: 8
a -= 2; // Equivalent to a = a - 2
console.log("a after -= 2: " + a); // Output: 6
a *= 4; // Equivalent to a = a * 4
console.log("a after *= 4: " + a); // Output: 24
a /= 6; // Equivalent to a = a / 6
console.log("a after /= 6: " + a); // Output: 4

// Unary Operators  
let b = 10;
console.log("b before increment: " + b);
b++; // Increment
console.log("b after increment: " + b); // Output: 11
b--; // Decrement
console.log("b after decrement: " + b); // Output: 10
// Comparison Operators
let p = 7;
let q = 10;
console.log("p == q: " + (p == q));
console.log("p != q: " + (p != q));
console.log("p > q: " + (p > q));
console.log("p < q: " + (p < q));
console.log("p >= q: " + (p >= q));
console.log("p <= q: " + (p <= q));

// Logical Operators
let isAdult = true;
let hasID = false;
console.log("isAdult && hasID: " + (isAdult && hasID)); // Logical AND
console.log("isAdult || hasID: " + (isAdult || hasID)); // Logical OR
console.log("!isAdult: " + (!isAdult)); // Logical NOT


// addition and subtraction of Infinity and -Infinity   
console.log("Infinity + 1000: " + (Infinity + 1000)); // Output: Infinity
console.log("-Infinity - 500: " + (-Infinity - 500)); // Output: -Infinity  
console.log("Infinity - Infinity: " + (Infinity - Infinity)); // Output: NaN
console.log("-Infinity + Infinity: " + (-Infinity + Infinity)); // Output: NaN
console.log("Infinity / 2: " + (Infinity / 2)); // Output: Infinity
console.log("-Infinity * 3: " + (-Infinity * 3)); // Output: -Infinity  
console.log("5 / Infinity: " + (5 / Infinity)); // Output: 0
console.log("5 / -Infinity: " + (5 / -Infinity)); // Output: -0
console.log("Infinity % 3: " + (Infinity % 3)); // Output: NaN
console.log("-Infinity % 3: " + (-Infinity % 3)); // Output: NaN
// Summary:
// - JavaScript provides various operators for arithmetic, assignment, comparison, and logical operations.
// - Arithmetic operators perform mathematical calculations.
// - Assignment operators assign values to variables with shorthand notation.
// - Comparison operators compare values and return boolean results.
// - Logical operators combine boolean values for complex conditions.

// use of + sign with strings and numbers
let str1 = "Hello, ";
let str2 = "world!";
let combinedString = str1 + str2;
console.log("Combined String: " + combinedString); // Output: Hello, world!
let num1 = 5;
let num2 = 10;
let combinedNumber = num1 + num2;
console.log("Combined Number: " + combinedNumber); // Output: 15
let mixed = str1 + num1;
console.log("Mixed Combination: " + mixed); // Output: Hello, 5 
// Summary:
// - The + operator can be used for both string concatenation and numerical addition.
// - When used with strings, it combines them into a single string.
// - When used with numbers, it performs addition.

// use of + sign with unary plus
let strNum = "42";
let convertedNum = +strNum; // Unary plus converts string to number
console.log("Converted Number: " + convertedNum); // Output: 42
console.log("Type of convertedNum: " + typeof convertedNum);
// Summary:
// - The unary plus operator (+) can convert a string representation of a number into an actual number type.
// - It is a quick way to perform type conversion in JavaScript.    
// use of - sign with unary minus
let positiveNum = 10;
let negativeNum = -positiveNum; // Unary minus converts to negative
console.log("Negative Number: " + negativeNum); // Output: -10
let strNum2 = "25";
let negativeConvertedNum = -strNum2; // Unary minus converts string to negative number
console.log("Negative Converted Number: " + negativeConvertedNum); // Output: -25
// Summary:
// - The unary minus operator (-) can convert a positive number to its negative counterpart.
// - It can also convert a string representation of a number into a negative number type.
// use of ++ sign with pre-increment and post-increment
let count1 = 5;
let preIncrement = ++count1; // Pre-increment: increments count1, then assigns to preIncrement
console.log("Pre-Increment: " + preIncrement); // Output: 6
let count2 = 5;
let postIncrement = count2++; // Post-increment: assigns count2 to postIncrement, then increments count2
console.log("Post-Increment: " + postIncrement); // Output: 5   
console.log("Count2 after Post-Increment: " + count2); // Output: 6
// Summary:
// - Pre-increment (++var) increments the variable before using its value.
// - Post-increment (var++) increments the variable after using its value.
// use of -- sign with pre-decrement and post-decrement
let count3 = 5;
let preDecrement = --count3;
console.log("Pre-Decrement: " + preDecrement); // Output: 4
let count4 = 5;
let postDecrement = count4--;
console.log("Post-Decrement: " + postDecrement); // Output: 5
console.log("Count4 after Post-Decrement: " + count4); // Output: 4
// Summary:
// - Pre-decrement (--var) decrements the variable before using its value.
// - Post-decrement (var--) decrements the variable after using its value.
// Overall Summary:
// - JavaScript provides a variety of operators for performing arithmetic, assignment, comparison, and logical operations.
// - Understanding how to use these operators effectively is essential for writing efficient and functional JavaScript code.



// Important Note:

// if one value is string and other is number, it implicitly converts number to string and concatenate them
let mixed1 = "The answer is: " + 42;
console.log(mixed1); // Output: The answer is: 42
let mixed2 = 42 + " is the answer.";
console.log(mixed2); // Output: 42 is the answer.

// In case of - operator, it converts string to number and perform subtraction
let mixed3 = "100" - 42;
console.log(mixed3); // Output: 58
let mixed4 = 100 - "42";
console.log(mixed4); // Output: 58
// Summary:
// - When using the + operator with a string and a number, JavaScript converts the number to a string and concatenates them.
// - When using the - operator with a string and a number, JavaScript converts the string to a number and performs subtraction.

// Important Note:
// If the string cannot be converted to a valid number, the result will be NaN (Not-a-Number)
let invalidSubtraction1 = "Hello" - 5;
console.log(invalidSubtraction1); // Output: NaN
let invalidSubtraction2 = 10 - "World";
console.log(invalidSubtraction2); // Output: NaN
// Summary:
// - If a string cannot be converted to a valid number during arithmetic operations, the result will be NaN (Not-a-Number).
// Important Note:
// The unary plus operator (+) can also convert invalid numeric strings to NaN
let invalidConversion = +"NotANumber";
console.log(invalidConversion); // Output: NaN  
// Summary:
// - The unary plus operator (+) attempts to convert a string to a number, and if the string is not a valid numeric representation, it results in NaN (Not-a-Number).   
// Important Note:
// Pre-increment and pre-decrement modify the variable before its value is used, while post-increment and post-decrement modify the variable after its value is used.
let num = 10;   
let preInc = ++num; // num becomes 11, preInc is 11
console.log("Pre-Increment Result: " + preInc); // Output: 11
num = 10;
let postInc = num++; // postInc is 10, then num becomes 11
console.log("Post-Increment Result: " + postInc); // Output: 10
// Summary:
// - Pre-increment (++var) and pre-decrement (--var) change the variable's value before it is used in an expression.
// - Post-increment (var++) and post-decrement (var--) change the variable's value after it is used in an expression.

// Important Note:
// Using increment and decrement operators on non-numeric types can lead to unexpected results.
let str = "5";  
let incStr = ++str; // str is converted to number 5, incremented to 6
console.log("Incremented String: " + incStr); // Output: 6
let bool = true; 
let decBool = --bool;
console.log("Decremented Boolean: " + decBool); // Output: 0
// Summary:
// - Incrementing a string that represents a number converts it to a number before incrementing.
// - Decrementing a boolean converts true to 1 and false to 0 before decrementing.











// If a value is a string, boolean, null, or undefined, the javascript engine converts it to a number as follows:
// - String: If the string represents a valid number (e.g., "42", "3.14"), it is converted to that number. If it does not represent a valid number (e.g., "hello", "123abc"), it is converted to NaN (Not-a-Number).
// - Boolean: true is converted to 1, and false is converted to 0.
// - Null: null is converted to 0.
// - Undefined: undefined is converted to NaN (Not-a-Number).

// first, convert the value to a number using the Number() function, then apply the unary minus operator to negate the value.
let strValue = "50";
let negatedStr = -Number(strValue);
console.log("Negated String Value: " + negatedStr); // Output: -50
let boolValue = true;
let negatedBool = -Number(boolValue);
console.log("Negated Boolean Value: " + negatedBool);
    // Output: -1
let nullValue = null;
let negatedNull = -Number(nullValue);
console.log("Negated Null Value: " + negatedNull);
    // Output: 0
let undefinedValue = undefined;
let negatedUndefined = -Number(undefinedValue);
console.log("Negated Undefined Value: " + negatedUndefined); // Output: NaN
// Summary:
// - The unary minus operator (-) converts various data types to numbers before negating them.
// - Strings representing valid numbers are converted to their numeric values, while invalid strings result in NaN.
// - Booleans, null, and undefined are also converted to numbers according to specific rules before negation.


// Important Note:
// Using * operator with numeric and non-numeric types
let strNumMul = "6";
let resultMul1 = strNumMul * 2;
console.log("Multiplication Result with String: " + resultMul1); // Output: 12
let boolNumMul = false;
let resultMul2 = boolNumMul * 10;
console.log("Multiplication Result with Boolean: " + resultMul2); // Output: 0
let nullNumMul = null;
let resultMul3 = nullNumMul * 5;
console.log("Multiplication Result with Null: " + resultMul3); // Output: 0
let undefinedNumMul = undefined;
let resultMul4 = undefinedNumMul * 3;
console.log("Multiplication Result with Undefined: " + resultMul4); // Output: NaN
// Summary:
// - The * operator converts non-numeric types to numbers before performing multiplication.
// - Strings representing valid numbers are converted to their numeric values.
// - Booleans, null, and undefined are converted to numbers according to specific rules before multiplication.

// Using * operator with one value as NaN or Infinity for all other values
let nanValue = NaN;
console.log("NaN * 5: " + (nanValue * 5)); // Output: NaN
console.log("NaN * '10': " + (nanValue * "10")); // Output: NaN
console.log("NaN * true: " + (nanValue * true)); // Output: NaN
console.log("NaN * null: " + (nanValue * null)); // Output: NaN
console.log("NaN * undefined: " + (nanValue * undefined)); // Output: NaN   
let infinityValue = Infinity;
console.log("Infinity * 5: " + (infinityValue * 5));
// Output: Infinity
console.log("Infinity * -2: " + (infinityValue * -2));
// Output: -Infinity
console.log("Infinity * 0: " + (infinityValue * 0)); // Output: NaN
console.log("Infinity * '10': " + (infinityValue * "10")); // Output: Infinity
console.log("Infinity * true: " + (infinityValue * true)); // Output: Infinity
console.log("Infinity * null: " + (infinityValue * null)); // Output: NaN
console.log("Infinity * undefined: " + (infinityValue * undefined)); // Output: NaN
// Summary:
// - Multiplying any value by NaN results in NaN.
// - Multiplying Infinity by a positive number results in Infinity, by a negative number results in -Infinity, and by zero results in NaN.  




// Using / operator with numeric and non-numeric types
let strNumDiv = "20";
let resultDiv1 = strNumDiv / 4;
console.log("Division Result with String: " + resultDiv1); // Output: 5
let boolNumDiv = true;
let resultDiv2 = boolNumDiv / 2;
console.log("Division Result with Boolean: " + resultDiv2); // Output: 0.5
let nullNumDiv = null;
let resultDiv3 = nullNumDiv / 3;
console.log("Division Result with Null: " + resultDiv3); // Output: 0
let undefinedNumDiv = undefined;
let resultDiv4 = undefinedNumDiv / 2;
console.log("Division Result with Undefined: " + resultDiv4); // Output: NaN
// Summary:
// - The / operator converts non-numeric types to numbers before performing division.
// - Strings representing valid numbers are converted to their numeric values.
// - Booleans, null, and undefined are converted to numbers according to specific rules before division.


// Using / operator with one value as NaN or Infinity for all other values
let nanValueDiv = NaN;
console.log("NaN / 5: " + (nanValueDiv / 5)); // Output: NaN
console.log("NaN / '10': " + (nanValueDiv / "10")); // Output: NaN
console.log("NaN / true: " + (nanValueDiv / true)); // Output: NaN
console.log("NaN / null: " + (nanValueDiv / null)); // Output: NaN
console.log("NaN / undefined: " + (nanValueDiv / undefined)); // Output: NaN
let infinityValueDiv = Infinity;
console.log("Infinity / 5: " + (infinityValueDiv / 5)); // Output: Infinity
console.log("Infinity / -2: " + (infinityValueDiv / -2)); // Output: -Infinity
console.log("Infinity / Infinity: " + (infinityValueDiv / Infinity)); // Output: NaN
console.log("Infinity / '10': " + (infinityValueDiv / "10")); // Output: Infinity
console.log("Infinity / true: " + (infinityValueDiv / true)); // Output: Infinity
console.log("Infinity / null: " + (infinityValueDiv / null)); // Output: NaN
console.log("Infinity / undefined: " + (infinityValueDiv / undefined)); // Output: NaN
// Summary:
// - Dividing any value by NaN results in NaN.
// - Dividing Infinity by a positive number results in Infinity, by a negative number results in -Infinity, and by Infinity results in NaN.



// Using % operator with numeric and non-numeric types
let strNumMod = "25";
let resultMod1 = strNumMod % 4;
console.log("Modulus Result with String: " + resultMod1);
// Output: 1
let boolNumMod = true;
let resultMod2 = boolNumMod % 2;
console.log("Modulus Result with Boolean: " + resultMod2);
// Output: 1
let nullNumMod = null;
let resultMod3 = nullNumMod % 3;
console.log("Modulus Result with Null: " + resultMod3);
// Output: 0
let undefinedNumMod = undefined;
let resultMod4 = undefinedNumMod % 2;
console.log("Modulus Result with Undefined: " + resultMod4);
// Output: NaN
// Summary:
// - The % operator converts non-numeric types to numbers before performing the modulus operation.
// - Strings representing valid numbers are converted to their numeric values.
// - Booleans, null, and undefined are converted to numbers according to specific rules before modulus operation.


// Using % operator with one value as NaN or Infinity for all other values


let nanValueMod = NaN;
console.log("NaN % 5: " + (nanValueMod % 5)); // Output: NaN
console.log("NaN % '10': " + (nanValueMod % "10")); // Output: NaN
console.log("NaN % true: " + (nanValueMod % true)); // Output: NaN
console.log("NaN % null: " + (nanValueMod % null));
    // Output: NaN
console.log("NaN % undefined: " + (nanValueMod % undefined)); // Output: NaN
let infinityValueMod = Infinity;
console.log("Infinity % 5: " + (infinityValueMod % 5)); // Output: NaN
console.log("Infinity % -2: " + (infinityValueMod % -2)); // Output: NaN
console.log("Infinity % Infinity: " + (infinityValueMod % Infinity)); // Output: NaN
console.log("Infinity % '10': " + (infinityValueMod % "10")); // Output: NaN
console.log("Infinity % true: " + (infinityValueMod % true)); // Output: NaN
console.log("Infinity % null: " + (infinityValueMod % null)); // Output: NaN
console.log("Infinity % undefined: " + (infinityValueMod % undefined)); // Output: NaN
// Summary:
// - The modulus operation with NaN results in NaN.
// - The modulus operation with Infinity also results in NaN regardless of the other operand.   



// when 0 is used with / operator
console.log("10 / 0: " + (10 / 0)); // Output: Infinity
console.log("-10 / 0: " + (-10 / 0)); // Output: -Infinity
console.log("0 / 0: " + (0 / 0)); // Output: NaN
// Summary:
// - Dividing a positive number by 0 results in Infinity.
// - Dividing a negative number by 0 results in -Infinity.
// - Dividing 0 by 0 results in NaN (Not-a-Number).

// when 0 is used with % operator
console.log("10 % 0: " + (10 % 0)); // Output: NaN
console.log("-10 % 0: " + (-10 % 0)); // Output: NaN
console.log("0 % 0: " + (0 % 0)); // Output: NaN
// Summary:
// - The modulus operation with 0 as the divisor results in NaN (Not-a-Number) for any dividend, including 0 itself.

// when 0 and string, etc is used with * operator
console.log("0 * '5': " + (0 * "5")); // Output: 0
console.log("0 * true: " + (0 * true)); // Output: 0
console.log("0 * null: " + (0 * null)); // Output: 0
console.log("0 * undefined: " + (0 * undefined)); // Output: NaN
// Summary:
// - Multiplying 0 by a valid numeric string, true, or null results in 0.
// - Multiplying 0 by undefined results in NaN (Not-a-Number).

// when 0 and string, etc is used with - operator   
console.log("0 - '5': " + (0 - "5")); // Output: -5
console.log("0 - true: " + (0 - true)); // Output: -1
console.log("0 - null: " + (0 - null)); // Output: 0
console.log("0 - undefined: " + (0 - undefined)); // Output: NaN
// Summary:
// - Subtracting a valid numeric string or true from 0 results in a negative number.
// - Subtracting null from 0 results in 0.
// - Subtracting undefined from 0 results in NaN (Not-a-Number).

// when 0 and string, etc is used with + operator
console.log("0 + '5': " + (0 + "5")); // Output: "05"
console.log("0 + true: " + (0 + true)); // Output: 1
console.log("0 + null: " + (0 + null)); // Output: 0
console.log("0 + undefined: " + (0 + undefined)); // Output: NaN
// Summary:
// - Adding 0 to a valid numeric string results in string concatenation.
// - Adding 0 to true results in 1.
// - Adding 0 to null results in 0.
// - Adding 0 to undefined results in NaN (Not-a-Number).

// when 0 and string, etc is used with ++ operator
let zeroInc1 = 0;
console.log("++0: " + ++zeroInc1); // Output: 1
let zeroInc2 = "0";
console.log("++'0': " + ++zeroInc2);    // Output: 1    
let zeroInc3 = null;
console.log("++null: " + ++zeroInc3); // Output: 1
let zeroInc4 = undefined;
console.log("++undefined: " + ++zeroInc4); // Output: NaN   
// Summary:
// - Pre-incrementing 0, "0", or null results in 1.
// - Pre-incrementing undefined results in NaN (Not-a-Number).

// when 0 and string, etc is used with -- operator
let zeroDec1 = 0;
console.log("--0: " + --zeroDec1); // Output: -1
let zeroDec2 = "0";
console.log("--'0': " + --zeroDec2);    // Output: -1    
let zeroDec3 = null;
console.log("--null: " + --zeroDec3); // Output: -1
let zeroDec4 = undefined;
console.log("--undefined: " + --zeroDec4); // Output: NaN   
// Summary:
// - Pre-decrementing 0, "0", or null results in -1.
// - Pre-decrementing undefined results in NaN (Not-a-Number).



// when symbols and bigints are used with arithmetic operators
let sym = Symbol("sym");    
let bigIntNum = BigInt(10);

try {   
    console.log("sym + 5: " + (sym + 5)); // Throws TypeError
} catch (error) {
    console.log("Error: " + error.message); // Output: Error: Cannot convert a Symbol value to a number
}

try {
    console.log("sym - 3: " + (sym - 3)); // Throws TypeError
} catch (error) {
    console.log("Error: " + error.message); // Output: Error: Cannot convert a Symbol value to a number
}

try {
    console.log("sym * 2: " + (sym * 2)); // Throws TypeError
} catch (error) {
    console.log("Error: " + error.message); // Output: Error: Cannot convert a Symbol value to a number
}

try {
    console.log("sym / 2: " + (sym / 2)); // Throws TypeError
} catch (error) {
    console.log("Error: " + error.message); // Output: Error: Cannot convert a Symbol value to a number
}

console.log("bigIntNum + 5n: " + (bigIntNum + 5n)); // Output: 15n
console.log("bigIntNum - 3n: " + (bigIntNum - 3n)); // Output: 7n
console.log("bigIntNum * 2n: " + (bigIntNum * 2n)); // Output: 20n
console.log("bigIntNum / 2n: " + (bigIntNum / 2n)); // Output: 5n
// Summary:
// - Arithmetic operations with Symbol values throw TypeError.
// - Arithmetic operations with BigInt values work as expected, but both operands must be BigInts.




// remainder operator with negative numbers
console.log("10 % -3: " + (10 % -3)); // Output: 1
console.log("-10 % 3: " + (-10 % 3)); // Output: -1
console.log("-10 % -3: " + (-10 % -3)); // Output: -1
// Summary:
// - The sign of the remainder follows the sign of the dividend (the first operand) in JavaScript.

// remainder operator with floating-point numbers
console.log("5.5 % 2.2: " + (5.5 % 2.2)); // Output: 1.1
console.log("-5.5 % 2.2: " + (-5.5 % 2.2)); // Output: -1.1
console.log("5.5 % -2.2: " + (5.5 % -2.2)); // Output: 1.1
console.log("-5.5 % -2.2: " + (-5.5 % -2.2)); // Output: -1.1
// Summary:
// - The remainder operator (%) works with floating-point numbers in JavaScript, returning the remainder of the division.

// remainder operator with very large numbers
let largeNum1 = 1e+20;
let largeNum2 = 3e+10;
console.log("1e+20 % 3e+10: " + (largeNum1 % largeNum2)); // Output: 1e+10
let largeNum3 = -1e+20;
console.log("-1e+20 % 3e+10: " + (largeNum3 % largeNum2)); // Output: -1e+10
// Summary:
// - The remainder operator (%) can handle very large numbers in JavaScript, returning the correct remainder of the division.   

// remainder operator with very small numbers
let smallNum1 = 1e-10;
let smallNum2 = 3e-11;
console.log("1e-10 % 3e-11: " + (smallNum1 % smallNum2)); // Output: 1e-11
let smallNum3 = -1e-10;
console.log("-1e-10 % 3e-11: " + (smallNum3 % smallNum2)); // Output: -1e-11
// Summary:
// - The remainder operator (%) can handle very small numbers in JavaScript, returning the correct remainder of the division.

// remainder operator with NaN and Infinity
console.log("NaN % 5: " + (NaN % 5)); // Output: NaN
console.log("5 % NaN: " + (5 % NaN)); // Output: NaN
console.log("Infinity % 5: " + (Infinity % 5)); // Output: NaN
console.log("5 % Infinity: " + (5 % Infinity)); // Output: 5
console.log("-Infinity % 5: " + (-Infinity % 5)); // Output: NaN
console.log("5 % -Infinity: " + (5 % -Infinity)); // Output: 5
// Summary:
// - The remainder operator (%) with NaN results in NaN.
// - The remainder operator (%) with Infinity as the dividend results in NaN, while using Infinity as the divisor returns the dividend itself.  

// remainder operator with non-numeric types
console.log("'10' % 3: " + ("10" % 3)); // Output: 1
console.log("10 % '3': " + (10 % "3")); // Output: 1
console.log("true % 2: " + (true % 2)); // Output: 1
console.log("10 % false: " + (10 % false)); // Output: 0
console.log("null % 3: " + (null % 3)); // Output: 0
console.log("10 % undefined: " + (10 % undefined)); // Output: NaN
// Summary:
// - The remainder operator (%) converts non-numeric types to numbers before performing the operation.
// - Strings representing valid numbers are converted to their numeric values.
// - Booleans, null, and undefined are converted to numbers according to specific rules before the modulus operation.

// remainder operator with mixed types
console.log("'15' % true: " + ("15" % true)); // Output: 0
console.log("false % '4': " + (false % "4")); // Output: 0
console.log("null % false: " + (null % false)); // Output: NaN
console.log("undefined % '7': " + (undefined % "7")); // Output: NaN
// Summary:
// - The remainder operator (%) can handle mixed types by converting them to numbers before performing the operation.
// - The results depend on the specific conversions applied to each type.   
















// javascript assignment operator


// ## 1. Basic Assignment (=)
let x = 10;
console.log(x); // 10

let name = "John";
console.log(name); // "John"

// ## 2. Addition Assignment (+=)
let a = 5;
a += 3; // equivalent to: a = a + 3
console.log(a); // 8

let str = "Hello";
str += " World"; // string concatenation
console.log(str); // "Hello World"

// ## 3. Subtraction Assignment (-=)
let b = 10;
b -= 4; // equivalent to: b = b - 4
console.log(b); // 6

// ## 4. Multiplication Assignment (*=)
let c = 7;
c *= 2; // equivalent to: c = c * 2
console.log(c); // 14

// ## 5. Division Assignment (/=)
let d = 15;
d /= 3; // equivalent to: d = d / 3
console.log(d); // 5

// ## 6. Remainder Assignment (%=)
let e = 17;
e %= 5; // equivalent to: e = e % 5
console.log(e); // 2 (remainder of 17 ÷ 5)

// ## 7. Exponentiation Assignment (**=)
let f = 2;
f **= 3; // equivalent to: f = f ** 3
console.log(f); // 8 (2³)

// ## 8. Left Shift Assignment (<<=)
let g = 5; // binary: 101
g <<= 2; // equivalent to: g = g << 2
console.log(g); // 20 (binary: 10100)

// ## 9. Right Shift Assignment (>>=)
let h = 20; // binary: 10100
h >>= 2; // equivalent to: h = h >> 2
console.log(h); // 5 (binary: 101)

// ## 10. Unsigned Right Shift Assignment (>>>=)
let i = -10; // binary: ...11111111111111111111111111110110
i >>>= 2; // equivalent to: i = i >>> 2
console.log(i); // 1073741821 (treats number as unsigned)

// ## 11. Bitwise AND Assignment (&=)
let j = 5;  // binary: 101
let k = 3;  // binary: 011
j &= k;     // equivalent to: j = j & k
console.log(j); // 1 (binary: 001)

// ## 12. Bitwise OR Assignment (|=)
let l = 5;  // binary: 101
let m = 3;  // binary: 011
l |= m;     // equivalent to: l = l | m
console.log(l); // 7 (binary: 111)

// ## 13. Bitwise XOR Assignment (^=)
let n = 5;  // binary: 101
let o = 3;  // binary: 011
n ^= o;     // equivalent to: n = n ^ o
console.log(n); // 6 (binary: 110)

// ## Complete Example Showing Multiple Operators
let value = 10;
console.log("Initial value:", value); // 10

value += 5;
console.log("After +=", value); // 15

value -= 3;
console.log("After -=", value); // 12

value *= 2;
console.log("After *=", value); // 24

value /= 4;
console.log("After /=", value); // 6

value %= 4;
console.log("After %=", value); // 2

value **= 3;
console.log("After **=", value); // 8


























// Unary operators 




// ## 1. Unary Plus (+)
// **Converts operand to a number**

// String to number conversion
console.log(+"42");        // 42
console.log(+"3.14");      // 3.14
console.log(+"Hello");     // NaN
console.log(+"");          // 0
console.log(+"  123  ");   // 123

// Boolean to number conversion
console.log(+true);        // 1
console.log(+false);       // 0

// Other conversions
console.log(+null);        // 0
console.log(+undefined);   // NaN
console.log(+[]);          // 0
console.log(+[5]);         // 5
console.log(+[1, 2]);      // NaN

// Practical use cases
let userInput = "25";
let age = +userInput;      // Convert string to number
console.log(age + 5);      // 30

let isActive = true;
let numericStatus = +isActive;
console.log(numericStatus); // 1

// ## 2. Unary Negation (-)
// **Converts operand to a number and negates it**

// String to negative number
console.log(-"42");        // -42
console.log(-"3.14");      // -3.14
console.log(-"Hello");     // NaN

// Boolean to negative number
console.log(-true);        // -1
console.log(-false);       // -0

// Other conversions
console.log(-null);        // -0
console.log(-undefined);   // NaN
console.log(-[]);          // -0
console.log(-[5]);         // -5

// Practical use case: reversing values
let temperature = "23";
let negativeTemp = -temperature;
console.log(negativeTemp); // -23

// ## 3. Logical NOT (!)
// **Converts operand to boolean and returns inverted value**

// String to boolean conversion
console.log(!"Hello");     // false
console.log(!"");          // true
console.log(!"0");         // false

// Number to boolean conversion
console.log(!0);           // true
console.log(!1);           // false
console.log(!42);          // false
console.log(!NaN);         // true

// Other conversions
console.log(!null);        // true
console.log(!undefined);   // true
console.log(![]);          // false
console.log(!{});          // false

// Double NOT (!!) for boolean conversion
console.log(!!"Hello");    // true
console.log(!!"");         // false
console.log(!!0);          // false
console.log(!!1);          // true

// Practical use cases
let username = "";
if (!username) {
    console.log("Username is required"); // This will execute
}

let isLoggedIn = "yes";
let booleanStatus = !!isLoggedIn;
console.log(booleanStatus); // true

// ## 4. Increment (++)
// **Increases operand by 1**

// Post-increment (returns value then increments)
let a = 5;
console.log(a++);  // 5
console.log(a);    // 6

// Pre-increment (increments then returns value)
let b = 5;
console.log(++b);  // 6
console.log(b);    // 6

// With type conversion
let str = "10";
str++;
console.log(str);  // 11 (string converted to number)

let bool = true;
bool++;
console.log(bool); // 2 (true becomes 1, then increments to 2)

// ## 5. Decrement (--)
// **Decreases operand by 1**

// Post-decrement
let x = 8;
console.log(x--);  // 8
console.log(x);    // 7

// Pre-decrement
let y = 8;
console.log(--y);  // 7
console.log(y);    // 7

// With type conversion
let str = "15";
str--;
console.log(str);  // 14

let bool = false;
bool--;
console.log(bool); // -1 (false becomes 0, then decrements to -1)

// ## 6. typeof
// **Returns the type of the operand as a string**

console.log(typeof "hello");      // "string"
console.log(typeof 42);           // "number"
console.log(typeof true);         // "boolean"
console.log(typeof undefined);    // "undefined"
console.log(typeof null);         // "object" (historical bug)
console.log(typeof []);           // "object"
console.log(typeof {});           // "object"
console.log(typeof function(){}); // "function"

// Practical use case: type checking
function processValue(value) {
    if (typeof value === 'string') {
        return value.toUpperCase();
    } else if (typeof value === 'number') {
        return value * 2;
    }
    return value;
}

// ## 7. void
// **Evaluates expression and returns undefined**

console.log(void 0);              // undefined
console.log(void "hello");        // undefined
console.log(void (2 + 3));        // undefined

// Practical use case: preventing navigation
// <a href="javascript:void(0)" onclick="doSomething()">Click</a>

// Use case: immediately invoked function
void function iife() {
    console.log("IIFE executed");
}();

// ## 8. delete
// **Deletes a property from an object**

let person = {
    name: "John",
    age: 30,
    city: "New York"
};

console.log(person.age);  // 30
delete person.age;
console.log(person.age);  // undefined
console.log('age' in person); // false

// Cannot delete variables
let x = 10;
// delete x; // This would throw an error in strict mode

// Delete array elements (creates sparse array)
let arr = [1, 2, 3, 4];
delete arr[2];
console.log(arr);        // [1, 2, empty, 4]
console.log(arr[2]);     // undefined
console.log(arr.length); // 4 (length doesn't change)

// ## Practical Conversion Examples

// String to number conversions
function convertToNumber(value) {
    return +value;
}

console.log(convertToNumber("123"));     // 123
console.log(convertToNumber("12.34"));   // 12.34
console.log(convertToNumber(""));        // 0
console.log(convertToNumber("abc"));     // NaN

// Boolean conversion patterns
function convertToBoolean(value) {
    return !!value;
}

console.log(convertToBoolean(0));        // false
console.log(convertToBoolean(1));        // true
console.log(convertToBoolean(""));       // false
console.log(convertToBoolean("hello"));  // true
console.log(convertToBoolean(null));     // false
console.log(convertToBoolean(undefined)); // false

// Form input processing
function processFormInput(input) {
    const numericValue = +input;
    const isValid = !!input && !isNaN(numericValue);
    
    return {
        original: input,
        numeric: numericValue,
        isValid: isValid
    };
}

console.log(processFormInput("25"));
// { original: "25", numeric: 25, isValid: true }

console.log(processFormInput(""));
// { original: "", numeric: 0, isValid: false }

// These unary operators are essential for type conversion and value manipulation in JavaScript, especially when working with user input, form data, and dynamic values.
































// comparison operators


// # JavaScript Comparison Operators - Complete Scenarios

// ## 1. Strict Equality (===)
// **Compares value AND type**

// ### Number vs Number
console.log(5 === 5);        // true
console.log(5 === 10);       // false
console.log(0 === -0);       // true
console.log(NaN === NaN);    // false (special case)
console.log(Infinity === Infinity); // true

// ### String vs String
console.log("hello" === "hello");    // true
console.log("hello" === "world");    // false
console.log("5" === "5");           // true
console.log("" === "");             // true
console.log("hello" === "HELLO");   // false (case sensitive)

// ### Boolean vs Boolean
console.log(true === true);      // true
console.log(false === false);    // true
console.log(true === false);     // false

// ### Undefined vs Undefined / Null vs Null
console.log(undefined === undefined); // true
console.log(null === null);           // true
console.log(undefined === null);      // false

// ## 2. Strict Inequality (!==)
// **Checks if values are different OR types are different**

console.log(5 !== 5);           // false
console.log(5 !== "5");         // true (different types)
console.log(true !== 1);        // true (different types)
console.log(null !== undefined); // true
console.log(NaN !== NaN);       // true (special case)

// ## 3. Loose Equality (==)
// **Performs type coercion before comparison**

// ### Number vs String
console.log(5 == "5");          // true (string converted to number)
console.log(0 == "");           // true (empty string becomes 0)
console.log(1 == "1");          // true
console.log(1 == "01");         // true
console.log(1 == "1.0");        // true
console.log(1 == "1abc");       // false ("1abc" becomes NaN)

// ### Boolean vs Other Types
console.log(true == 1);         // true (true becomes 1)
console.log(false == 0);        // true (false becomes 0)
console.log(true == "1");       // true
console.log(false == "");       // true
console.log(false == "0");      // true
console.log(true == "true");    // false ("true" becomes NaN)

// ### Null vs Undefined
console.log(null == undefined); // true (special rule)
console.log(null == 0);         // false
console.log(undefined == 0);    // false

// ### Special Cases
console.log(NaN == NaN);        // false
console.log(0 == -0);           // true
console.log("" == []);          // true (array becomes string)
console.log(0 == []);           // true (array becomes 0)

// ## 4. Loose Inequality (!=)
// **Performs type coercion before checking inequality**

console.log(5 != "5");          // false (values are equal after coercion)
console.log(5 != "6");          // true
console.log(true != 1);         // false
console.log(null != undefined); // false
console.log(0 != "");           // false

// ## 5. Greater Than (>)

// ### Number vs Number
console.log(10 > 5);            // true
console.log(5 > 10);            // false
console.log(5 > 5);             // false
console.log(-5 > -10);          // true
console.log(Infinity > 1000000); // true
console.log(-Infinity > -1000000); // false

// ### String vs String (lexicographical order)
console.log("b" > "a");         // true
console.log("abc" > "abb");     // true
console.log("2" > "10");        // true (character-by-character comparison)
console.log("apple" > "banana"); // false

// ### Mixed Types with Coercion
console.log("10" > 5);          // true ("10" becomes 10)
console.log("5" > 10);          // false ("5" becomes 5)
console.log(true > false);      // true (true=1, false=0)
console.log("abc" > 5);         // false ("abc" becomes NaN)

// ## 6. Less Than (<)

// ### Number vs Number
console.log(5 < 10);            // true
console.log(10 < 5);            // false
console.log(5 < 5);             // false
console.log(-10 < -5);          // true

// ### String vs String
console.log("a" < "b");         // true
console.log("abb" < "abc");     // true
console.log("10" < "2");        // true (character '1' < '2')
console.log("apple" < "banana"); // true

// ### Mixed Types
console.log(5 < "10");          // true
console.log(false < true);      // true (0 < 1)
console.log(null < 1);          // true (null becomes 0)

// ## 7. Greater Than or Equal (>=)

console.log(5 >= 5);            // true
console.log(5 >= 3);            // true
console.log(5 >= 10);           // false
console.log("b" >= "a");        // true
console.log("5" >= 5);          // true
console.log(true >= 1);         // true

// ## 8. Less Than or Equal (<=)

console.log(5 <= 5);            // true
console.log(3 <= 5);            // true
console.log(10 <= 5);           // false
console.log("a" <= "b");        // true
console.log("5" <= 5);          // true
console.log(false <= 0);        // true

// ## Special Scenarios and Edge Cases

// ### NaN Comparisons
console.log(NaN === NaN);       // false
console.log(NaN == NaN);        // false
console.log(NaN > 5);           // false
console.log(NaN < 5);           // false
console.log(NaN >= NaN);        // false
console.log(NaN <= NaN);        // false

// ### Infinity Comparisons
console.log(Infinity > 1000000);           // true
console.log(-Infinity < -1000000);         // true
console.log(Infinity === Infinity);        // true
console.log(-Infinity === -Infinity);      // true
console.log(Infinity > -Infinity);         // true

// ### Zero Comparisons
console.log(0 === -0);          // true
console.log(0 == -0);           // true
console.log(0 > -0);            // false
console.log(0 < -0);            // false

// ### String Number Comparisons
console.log("10" > "2");        // false (character comparison)
console.log("10" > 2);          // true (numeric comparison)
console.log("010" == 10);       // true
console.log("0xFF" == 255);     // true (hexadecimal)

// ### Boolean in Comparisons
console.log(true > false);      // true (1 > 0)
console.log(true == 1);         // true
console.log(false == 0);        // true
console.log(true === 1);        // false

// ### Null and Undefined
console.log(null == undefined); // true
console.log(null === undefined); // false
console.log(null > 0);          // false (null becomes 0, 0 > 0 is false)
console.log(null >= 0);         // true (null becomes 0, 0 >= 0 is true)
console.log(undefined > 0);     // false (undefined becomes NaN)

// ## Practical Comparison Examples

// Form validation example
function validateAge(ageInput, minAge) {
    const age = Number(ageInput);
    
    // Strict comparison for type safety
    if (typeof age !== 'number' || isNaN(age)) {
        return "Invalid age input";
    }
    
    // Numeric comparison
    if (age >= minAge) {
        return "Age requirement satisfied";
    } else {
        return `Must be at least ${minAge} years old`;
    }
}

console.log(validateAge("25", 18)); // "Age requirement satisfied"
console.log(validateAge("15", 18)); // "Must be at least 18 years old"

// String sorting helper
function compareStrings(a, b, caseSensitive = false) {
    const strA = caseSensitive ? a : a.toLowerCase();
    const strB = caseSensitive ? b : b.toLowerCase();
    
    if (strA < strB) return -1;
    if (strA > strB) return 1;
    return 0;
}

console.log(compareStrings("Apple", "banana")); // -1
console.log(compareStrings("apple", "Banana", true)); // 1

// Safe number comparison (handles NaN)
function safeCompare(a, b) {
    if (isNaN(a) || isNaN(b)) {
        return false;
    }
    return a === b;
}

console.log(safeCompare(5, 5));     // true
console.log(safeCompare(5, "5"));   // false
console.log(safeCompare(NaN, NaN)); // false

// ## Key Takeaways

// 1. **Use `===` and `!==`** for most comparisons (avoids unexpected type coercion)
// 2. **String comparisons** are character-by-character (lexicographical)
// 3. **NaN** is not equal to anything, including itself
// 4. **null and undefined** are only loosely equal to each other
// 5. **Type coercion** happens with `==`, `!=`, `>`, `<`, `>=`, `<=`
// 6. **Empty strings, null, false, 0** are loosely equal but strictly different

























// # JavaScript Object vs Non-Object Comparison - Complete Scenarios

// ## 1. Loose Equality (==) - With Type Coercion

// ### Object vs Number
console.log({} == 0);               // false
console.log({} == 1);               // false
console.log([] == 0);               // true ([] becomes "" then 0)
console.log([5] == 5);              // true ([5] becomes "5" then 5)
console.log([1,2] == 1);            // false ([1,2] becomes "1,2" then NaN)
console.log(new Number(5) == 5);    // true

let obj = { valueOf: () => 10 };
console.log(obj == 10);             // true (custom valueOf)

// ### Object vs String
console.log({} == "hello");         // false
console.log([] == "");              // true ([] becomes "")
console.log([""] == "");            // true ([""] becomes "")
console.log(["hello"] == "hello");  // true
console.log(["hello", "world"] == "hello,world"); // true
console.log({} == "[object Object]"); // true ({} becomes "[object Object]")

let obj = { toString: () => "custom" };
console.log(obj == "custom");       // true (custom toString)

// ### Object vs Boolean
console.log({} == true);            // false ({} becomes "[object Object]" then NaN)
console.log({} == false);           // false
console.log([] == true);            // false ([] becomes "" then 0, 0 == 1 is false)
console.log([] == false);           // true ([] becomes "" then 0, 0 == 0 is true)
console.log([1] == true);           // true ([1] becomes "1" then 1, 1 == 1 is true)
console.log([0] == false);          // true ([0] becomes "0" then 0, 0 == 0 is true)

let obj = { valueOf: () => 1 };
console.log(obj == true);           // true (1 == 1)

// ### Object vs null/undefined
console.log({} == null);            // false
console.log({} == undefined);       // false
console.log([] == null);            // false
console.log([] == undefined);       // false
console.log(null == undefined);     // true (special case - only for null/undefined)

// ## 2. Strict Equality (===) - No Type Coercion

console.log({} === 0);              // false (different types)
console.log([] === "");             // false (different types)
console.log([5] === 5);             // false (different types)
console.log({} === true);           // false (different types)
console.log({} === null);           // false
console.log({} === undefined);      // false
console.log(new Number(5) === 5);   // false (object vs primitive)

// ## 3. Relational Comparisons (>, <, >=, <=) - With Type Coercion

// ### Object vs Number
console.log({} > 0);                // false ({} becomes NaN)
console.log([] > 0);                // false ([] becomes 0, 0 > 0 is false)
console.log([] >= 0);               // true ([] becomes 0, 0 >= 0 is true)
console.log([5] > 4);               // true ([5] becomes 5)
console.log([1,2] > 1);             // false ([1,2] becomes NaN)

let obj = { valueOf: () => 10 };
console.log(obj > 5);               // true (10 > 5)

// ### Object vs String
console.log({} > "a");              // false ({} becomes "[object Object]")
console.log([] > "a");              // false ([] becomes "")
console.log(["b"] > "a");           // true (["b"] becomes "b")
console.log({} > "[object Object]"); // false (equal strings)
console.log(["abc"] > "abb");       // true ("abc" > "abb")

let obj = { toString: () => "zebra" };
console.log(obj > "apple");         // true ("zebra" > "apple")

// ### Object vs Boolean
console.log({} > true);             // false ({} becomes NaN)
console.log([] > false);            // false ([] becomes 0, 0 > 0 is false)
console.log([1] > false);           // true ([1] becomes 1, 1 > 0 is true)
console.log([0] > false);           // false ([0] becomes 0, 0 > 0 is false)

// ## 4. Array Specific Scenarios

// ### Array vs Primitive
// Empty array
console.log([] == 0);               // true
console.log([] == "");              // true
console.log([] == false);           // true

// Single element array
console.log([0] == 0);              // true
console.log([1] == 1);              // true
console.log(["hello"] == "hello");  // true
console.log([true] == true);        // true ([true] becomes "true" then NaN)

// Multi-element array
console.log([1,2] == "1,2");        // true
console.log([1,2] == 1);            // false
console.log([null] == "");          // true ([null] becomes "")
console.log([undefined] == "");     // true ([undefined] becomes "")

// Nested arrays
console.log([[1]] == "1");          // true
console.log([[[2]]] == "2");        // true

// ## 5. Custom Object with valueOf and toString

// ### Custom valueOf
let customObj = {
    valueOf: function() { return 42; },
    toString: function() { return "custom"; }
};

console.log(customObj == 42);               // true (valueOf used)
console.log(customObj == "custom");         // false (valueOf takes precedence)
console.log(customObj > 40);                // true
console.log(String(customObj));             // "custom" (toString used)

// ### Custom toString
let stringObj = {
    toString: function() { return "hello world"; }
};

console.log(stringObj == "hello world");    // true
console.log(stringObj > "hello");           // true ("hello world" > "hello")
console.log(stringObj + "!");               // "hello world!" (toString used)

// ### Both valueOf and toString
let complexObj = {
    valueOf: function() { return 100; },
    toString: function() { return "two hundred"; }
};

// valueOf takes precedence in numeric contexts
console.log(complexObj == 100);             // true
console.log(complexObj > 50);               // true
console.log("Value: " + complexObj);        // "Value: 100" (valueOf used)

// ## 6. Date Object Comparisons

let date1 = new Date("2023-01-01");
let date2 = new Date("2023-12-31");

console.log(date1 == "Sun Jan 01 2023 05:30:00 GMT+0530"); // depends on locale
console.log(date1 < date2);                 // true
console.log(date1 > 1672531200000);         // true (timestamp comparison)
console.log(date1 == date1.getTime());      // false (object vs number)
console.log(date1.getTime() == date1.getTime()); // true

// Date vs number
console.log(date1 > 1000000);               // true
console.log(date1 == date1.toString());     // true (loose equality)

// ## 7. Function Objects

function test() { return "hello"; }

console.log(test == "function test() { return \"hello\"; }"); // false
console.log(test == test);                 // true (same reference)
console.log(test > 0);                     // false
console.log(test == true);                 // false

// Function with custom methods
test.valueOf = () => 999;
test.toString = () => "CUSTOM_FUNCTION";

console.log(test == 999);                  // true
console.log(test == "CUSTOM_FUNCTION");    // false (valueOf precedence)

// ## 8. Special Object Types

// ### RegExp Objects
let regex = /hello/;

console.log(regex == "/hello/");            // false
console.log(regex == regex);                // true
console.log(regex > 0);                     // false
console.log(regex == true);                 // false

regex.valueOf = () => 50;
console.log(regex == 50);                   // true

// ### Number Objects
let numObj = new Number(5);

console.log(numObj == 5);                   // true
console.log(numObj === 5);                  // false
console.log(numObj > 4);                    // true
console.log(numObj == "5");                 // true

console.log(typeof numObj);                 // "object"
console.log(typeof 5);                      // "number"

// ### String Objects
let strObj = new String("hello");

console.log(strObj == "hello");             // true
console.log(strObj === "hello");            // false
console.log(strObj > "hell");               // true
console.log(strObj == 5);                   // false

strObj.valueOf = () => "custom";
console.log(strObj == "custom");            // true

// ## 9. Practical Examples and Edge Cases

// ### Form Data Processing
function processFormValue(formValue, expectedValue) {
    console.log(`Input: ${formValue}, Type: ${typeof formValue}`);
    console.log(`Expected: ${expectedValue}, Type: ${typeof expectedValue}`);
    console.log(`Loose equality: ${formValue == expectedValue}`);
    console.log(`Strict equality: ${formValue === expectedValue}`);
    console.log('---');
}

// Common scenarios
processFormValue([5], 5);           // Loose: true, Strict: false
processFormValue([0], false);       // Loose: true, Strict: false
processFormValue([], "");           // Loose: true, Strict: false
processFormValue({}, "[object Object]"); // Loose: true, Strict: false
processFormValue([1,2], "1,2");     // Loose: true, Strict: false

// ### Safe Comparison Utility
function safeCompare(a, b) {
    // Handle object vs primitive comparisons safely
    if (typeof a !== typeof b) {
        // For different types, only allow specific safe conversions
        if (a == null || b == null) {
            return a === b;
        }
        
        // Allow number-string conversion but not object-primitive
        if (['number', 'string'].includes(typeof a) && 
            ['number', 'string'].includes(typeof b)) {
            return a == b;
        }
        
        return false;
    }
    
    return a === b;
}

console.log(safeCompare([5], 5));           // false
console.log(safeCompare("5", 5));           // true
console.log(safeCompare(null, undefined));  // false
console.log(safeCompare({}, {}));           // false (different objects)

// ### Object Comparison Helper
function compareObjectToPrimitive(obj, primitive) {
    const primitiveType = typeof primitive;
    
    switch (primitiveType) {
        case 'number':
            const numValue = Number(obj);
            return !isNaN(numValue) && numValue === primitive;
            
        case 'string':
            return String(obj) === primitive;
            
        case 'boolean':
            const boolValue = Boolean(obj);
            return boolValue === primitive;
            
        default:
            return false;
    }
}

console.log(compareObjectToPrimitive([5], 5));     // true
console.log(compareObjectToPrimitive([], 0));      // false (Boolean([]) is true)
console.log(compareObjectToPrimitive({}, "hello")); // false

// ## Key Takeaways

// 1. **Objects are converted to primitives** using `valueOf()` then `toString()` in loose comparisons
// 2. **Arrays become strings** by joining elements with commas
// 3. **Empty arrays** become empty strings, then 0 in numeric contexts
// 4. **Plain objects** become `"[object Object]"`
// 5. **Strict equality (`===`)** always returns `false` for object vs primitive
// 6. **Custom `valueOf`/`toString`** methods can change comparison behavior
// 7. **`null` and `undefined`** only equal each other (not objects)
// 8. **Always use strict equality** when type safety is important

































// # JavaScript Logical NOT (!) Operator - Complete Scenarios

// ## 1. With Boolean Values

console.log(!true);          // false
console.log(!false);         // true

console.log(!!true);         // true (double NOT)
console.log(!!false);        // false (double NOT)

// ## 2. With Number Values

// ### Zero and Negative Zero
console.log(!0);             // true (0 is falsy)
console.log!(-0);            // true (-0 is falsy)
console.log(!!0);            // false
console.log(!!-0);           // false

// ### Positive Numbers
console.log(!1);             // false (non-zero is truthy)
console.log(!42);            // false
console.log(!3.14);          // false
console.log(!1000);          // false
console.log(!!1);            // true

// ### Negative Numbers
console.log!(-1);            // false (non-zero is truthy)
console.log!(-42);           // false
console.log!(-3.14);         // false
console.log(!!-1);           // true

// ### Special Numeric Values
console.log(!NaN);           // true (NaN is falsy)
console.log(!Infinity);      // false (Infinity is truthy)
console.log!(-Infinity);     // false (-Infinity is truthy)

console.log(!!NaN);          // false
console.log(!!Infinity);     // true

// ## 3. With String Values

// ### Empty Strings
console.log(!"");            // true (empty string is falsy)
console.log(!'');            // true
console.log(!!"");           // false
console.log(!!'');           // false

// ### Non-empty Strings
console.log(!"hello");       // false (non-empty string is truthy)
console.log(!" ");           // false (space is non-empty)
console.log(!"0");           // false (string "0" is truthy)
console.log(!"false");       // false
console.log(!"null");        // false

console.log(!!"hello");      // true
console.log(!!"0");          // true
console.log(!!"false");      // true

// ### String with Only Whitespace
console.log(!"   ");         // false (whitespace string is truthy)
console.log(!"\t");          // false
console.log(!"\n");          // false
console.log(!!"   ");        // true

// ## 4. With null and undefined

console.log(!null);          // true (null is falsy)
console.log(!undefined);     // true (undefined is falsy)

console.log(!!null);         // false
console.log(!!undefined);    // false

// ## 5. With Objects

// ### Plain Objects
console.log(!{});            // false (objects are truthy)
console.log(!{ name: "John" }); // false
console.log(!{ length: 0 }); // false
console.log(!{ undefined: undefined }); // false

console.log(!!{});           // true
console.log(!!{ name: "John" }); // true

// ### Arrays
console.log(![]);            // false (arrays are truthy)
console.log(![1, 2, 3]);     // false
console.log(![0]);           // false
console.log(![false]);       // false
console.log(![null]);        // false
console.log(![undefined]);   // false
console.log(![[]]);          // false

console.log(!![]);           // true
console.log(!![0]);          // true
console.log(!![false]);      // true

// ### Special Objects
console.log(!new Date());    // false (Date objects are truthy)
console.log(!/regex/);       // false (RegExp objects are truthy)
console.log(!new Error());   // false (Error objects are truthy)
console.log(!new Number(0)); // false (Number object is truthy)
console.log(!new String("")); // false (String object is truthy)
console.log(!new Boolean(false)); // false (Boolean object is truthy)

console.log(!!new Date());   // true
console.log(!!/regex/);      // true

// ## 6. With Functions

function normalFunction() {}
const arrowFunction = () => {};
async function asyncFunction() {}
function* generatorFunction() {}

console.log(!normalFunction);    // false (functions are truthy)
console.log(!arrowFunction);     // false
console.log(!asyncFunction);     // false
console.log(!generatorFunction); // false

console.log(!!normalFunction);   // true
console.log(!!arrowFunction);    // true

// Function invocation result
console.log(!normalFunction());  // true (undefined return is falsy)
console.log(!!normalFunction()); // false

// ## 7. With Symbol

console.log(!Symbol());          // false (Symbol is truthy)
console.log(!Symbol("desc"));    // false
console.log(!Symbol.iterator);   // false

console.log(!!Symbol());         // true
console.log(!!Symbol("desc"));   // true

// ## 8. With BigInt

console.log(!0n);                // true (0n is falsy)
console.log(!1n);                // false (non-zero BigInt is truthy)
console.log(!-1n);               // false
console.log(!1000000n);          // false

console.log(!!0n);               // false
console.log(!!1n);               // true

// ## 9. Special Cases and Edge Cases

// ### document.all (Legacy IE behavior)
// In modern browsers, document.all is truthy but == undefined
console.log(!document.all);      // false (truthy object)
console.log(!!document.all);     // true

// But it has special behavior with ==
console.log(document.all == undefined); // true in some browsers

// ### Object.create(null)
const obj = Object.create(null);
console.log(!obj);               // false (still an object, so truthy)
console.log(!!obj);              // true

// ### Overridden valueOf
const customObj = {
    valueOf: () => 0
};
console.log(!customObj);         // false (object is still truthy)
console.log(!!customObj);        // true

// But in numeric context:
console.log(customObj == 0);     // true

// ## 10. Practical Use Cases

// ### Truthy/Falsy Checking
function checkTruthy(value) {
    return !!value;
}

console.log(checkTruthy(0));         // false
console.log(checkTruthy(""));        // false
console.log(checkTruthy(null));      // false
console.log(checkTruthy(undefined)); // false
console.log(checkTruthy("hello"));   // true
console.log(checkTruthy(1));         // true
console.log(checkTruthy([]));        // true
console.log(checkTruthy({}));        // true

// ### Default Value Assignment
function getValue(value, defaultValue) {
    return !value ? defaultValue : value;
}

console.log(getValue("", "default"));        // "default"
console.log(getValue(null, "default"));      // "default"
console.log(getValue(undefined, "default")); // "default"
console.log(getValue(0, "default"));         // "default"
console.log(getValue("hello", "default"));   // "hello"
console.log(getValue(42, "default"));        // 42

// ### Form Validation
function validateForm(data) {
    const errors = [];
    
    if (!data.username) {
        errors.push("Username is required");
    }
    
    if (!data.email) {
        errors.push("Email is required");
    }
    
    if (!data.age || data.age < 18) {
        errors.push("Must be 18 or older");
    }
    
    return errors.length === 0 ? "Valid" : errors;
}

console.log(validateForm({ username: "john", email: "john@test.com", age: 25 }));
// "Valid"

console.log(validateForm({ username: "", email: null, age: 0 }));
// ["Username is required", "Email is required", "Must be 18 or older"]

// ### Conditional Rendering
function renderContent(user, items) {
    const shouldShowWelcome = !!user;
    const shouldShowEmptyState = !items || items.length === 0;
    const shouldShowAdminPanel = user && user.isAdmin;
    
    return {
        showWelcome: shouldShowWelcome,
        showEmptyState: shouldShowEmptyState,
        showAdminPanel: shouldShowAdminPanel
    };
}

const user = { name: "John", isAdmin: true };
const items = [];

console.log(renderContent(user, items));
// { showWelcome: true, showEmptyState: true, showAdminPanel: true }

console.log(renderContent(null, []));
// { showWelcome: false, showEmptyState: true, showAdminPanel: false }

// ## 11. Double NOT (!!) Pattern Examples

// ### Converting to Boolean
const values = [0, 1, "", "hello", null, undefined, [], {}, NaN, Infinity];

values.forEach(value => {
    console.log(`!!${String(value)} = ${!!value}`);
});
// Output:
// !!0 = false
// !!1 = true
// !! = false
// !!hello = true
// !!null = false
// !!undefined = false
// !! = true
// !![object Object] = true
// !!NaN = false
// !!Infinity = true

// ### Filtering Arrays
const mixedArray = [0, 1, "", "hello", null, undefined, [], {}, false, true];

const truthyValues = mixedArray.filter(value => !!value);
console.log(truthyValues);
// [1, "hello", [], {}, true]

const falsyValues = mixedArray.filter(value => !value);
console.log(falsyValues);
// [0, "", null, undefined, false]

// ### Short-circuit Evaluation
function getUserPreference(user) {
    // If user doesn't exist or user.preferences doesn't exist, return default
    return !!(user && user.preferences) ? user.preferences : { theme: "light" };
}

console.log(getUserPreference(null));                    // { theme: "light" }
console.log(getUserPreference({}));                      // { theme: "light" }
console.log(getUserPreference({ preferences: { theme: "dark" } })); 
// { theme: "dark" }

// ## 12. Common Pitfalls and Gotchas

// ### Array Length
const emptyArray = [];
const nonEmptyArray = [1, 2, 3];

console.log(!emptyArray);        // false (array object is truthy)
console.log(!emptyArray.length); // true (0 is falsy)
console.log(!nonEmptyArray);     // false
console.log(!nonEmptyArray.length); // false (3 is truthy)

// ### Object Properties
const obj = { 
    emptyString: "",
    zero: 0,
    falseValue: false,
    nullValue: null,
    undefinedValue: undefined
};

console.log(!obj.emptyString);      // true
console.log(!obj.zero);             // true
console.log(!obj.falseValue);       // true
console.log(!obj.nullValue);        // true
console.log(!obj.undefinedValue);   // true
console.log(!obj.nonExistent);      // true (undefined)

// ### Function Returns
function returnsZero() { return 0; }
function returnsEmptyString() { return ""; }
function returnsNull() { return null; }
function returnsObject() { return {}; }

console.log(!returnsZero());        // true
console.log(!returnsEmptyString()); // true
console.log(!returnsNull());        // true
console.log(!returnsObject());      // false (object is truthy)

// ## Summary Table

// | Value | !value | !!value | Falsy? |
// |-------|--------|---------|---------|
// | `false` | `true` | `false` | Yes |
// | `true` | `false` | `true` | No |
// | `0` | `true` | `false` | Yes |
// | `1` | `false` | `true` | No |
// | `""` | `true` | `false` | Yes |
// | `"hello"` | `false` | `true` | No |
// | `null` | `true` | `false` | Yes |
// | `undefined` | `true` | `false` | Yes |
// | `NaN` | `true` | `false` | Yes |
// | `Infinity` | `false` | `true` | No |
// | `[]` | `false` | `true` | No |
// | `{}` | `false` | `true` | No |
// | `function(){}` | `false` | `true` | No |
// | `Symbol()` | `false` | `true` | No |
// | `0n` | `true` | `false` | Yes |




// **Key Takeaways:**
// - Only **6 falsy values** in JavaScript: `false`, `0`, `""`, `null`, `undefined`, `NaN`
// - **All objects** (including arrays, functions, dates) are **truthy**
// - **Empty arrays** `[]` and **empty objects** `{}` are **truthy**
// - **Double NOT (!!)** is commonly used to convert any value to a proper boolean
// - **Logical NOT (!)** returns the opposite boolean representation of a value's truthiness




























// # JavaScript Logical OR (||) Operator - Complete Scenarios

// ## 1. Basic Usage with Primitives

// ### Boolean Values
console.log(true || false);     // true
console.log(false || true);     // true
console.log(false || false);    // false
console.log(true || true);      // true

// ### String Values
console.log("" || "default");        // "default"
console.log("hello" || "default");   // "hello"
console.log("" || "");               // ""
console.log("hello" || "world");     // "hello"

// ### Number Values
console.log(0 || 100);          // 100
console.log(42 || 100);         // 42
console.log(NaN || 100);        // 100
console.log(0 || 0);            // 0

// ### null and undefined
console.log(null || "value");       // "value"
console.log(undefined || "value");  // "value"
console.log(null || undefined);     // undefined
console.log(undefined || null);     // null

// ## 2. Practical Applications

// ### Default Values for Function Parameters
function greet(name) {
    const userName = name || "Guest";
    return `Hello, ${userName}!`;
}

console.log(greet("John"));     // "Hello, John!"
console.log(greet(""));         // "Hello, Guest!"
console.log(greet(null));       // "Hello, Guest!"
console.log(greet());           // "Hello, Guest!"

// ### Configuration with Fallbacks
function connectToDatabase(config) {
    const host = config.host || "localhost";
    const port = config.port || 5432;
    const username = config.username || "admin";
    const password = config.password || "secret";
    
    return `Connecting to ${username}@${host}:${port}`;
}

console.log(connectToDatabase({}));
// "Connecting to admin@localhost:5432"

console.log(connectToDatabase({ 
    host: "db.server.com", 
    port: 3306 
}));
// "Connecting to admin@db.server.com:3306"

// ### Feature Flags with Fallbacks
const userPreferences = {};
const systemDefaults = {
    theme: "dark",
    language: "en",
    notifications: true
};

const theme = userPreferences.theme || systemDefaults.theme;
const language = userPreferences.language || systemDefaults.language;
const notifications = userPreferences.notifications || systemDefaults.notifications;

console.log({ theme, language, notifications });
// { theme: "dark", language: "en", notifications: true }

// ## 3. Object Property Access

// ### Safe Object Property Access
const user = {
    profile: {
        name: "John",
        settings: {
            theme: "dark"
        }
    }
};

const user2 = {};

// Safe access with fallbacks
const theme = (user.profile && user.profile.settings && user.profile.settings.theme) || "light";
console.log(theme); // "dark"

const theme2 = (user2.profile && user2.profile.settings && user2.profile.settings.theme) || "light";
console.log(theme2); // "light"

// ### With Optional Chaining (ES2020+)
const user = {
    profile: {
        name: "John",
        settings: {
            theme: "dark"
        }
    }
};

const user2 = {};

const theme = user.profile?.settings?.theme || "light";
console.log(theme); // "dark"

const theme2 = user2.profile?.settings?.theme || "light";
console.log(theme2); // "light"

// ## 4. Function Arguments and API Calls

// ### API Response Handling
async function fetchUserData(userId) {
    try {
        const response = await fetch(`/api/users/${userId}`);
        const data = await response.json();
        
        return data || { error: "No data received" };
    } catch (error) {
        return { error: error.message || "Unknown error occurred" };
    }
}

// Simulated usage
const userData = null;
const result = userData || { name: "Default User", id: 0 };
console.log(result); // { name: "Default User", id: 0 }

// ### Form Validation with Default Messages
function validateEmail(email) {
    const error = 
        !email ? "Email is required" :
        !email.includes("@") ? "Invalid email format" :
        null;
    
    return error || "Email is valid";
}

console.log(validateEmail(""));           // "Email is required"
console.log(validateEmail("john"));       // "Invalid email format"
console.log(validateEmail("john@test.com")); // "Email is valid"

// ## 5. Multiple OR Operations

// ### Cascading Fallbacks
function getDisplayName(user) {
    return user.displayName || user.username || user.email || "Anonymous User";
}

const user1 = { displayName: "John Doe", username: "johndoe", email: "john@test.com" };
const user2 = { username: "janedoe", email: "jane@test.com" };
const user3 = { email: "bob@test.com" };
const user4 = {};

console.log(getDisplayName(user1)); // "John Doe"
console.log(getDisplayName(user2)); // "janedoe"
console.log(getDisplayName(user3)); // "bob@test.com"
console.log(getDisplayName(user4)); // "Anonymous User"

// ### Environment Configuration
const config = {
    database: {
        url: process.env.DB_URL || "localhost:5432",
        name: process.env.DB_NAME || "myapp",
        user: process.env.DB_USER || "admin",
        pass: process.env.DB_PASS || "password"
    },
    server: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || "development"
    }
};

console.log(config.database.url); // "localhost:5432" (if no env var)
console.log(config.server.port);  // 3000 (if no env var)

// ## 6. Short-Circuit Evaluation

// ### Conditional Function Execution
function logMessage(message) {
    console.log(`[LOG]: ${message}`);
}

function debugMessage(message) {
    console.log(`[DEBUG]: ${message}`);
}

const isProduction = false;
const isDebug = true;

// Only log in non-production, only debug when debug is enabled
!isProduction && logMessage("Application started");
isDebug && debugMessage("Debug information");

// Using OR for fallback actions
function processData(data, callback) {
    const result = data || fetchDefaultData();
    callback && callback(result);
}

processData(null, (data) => console.log("Processed:", data));

// ### Performance Optimization
function expensiveOperation() {
    console.log("Performing expensive operation...");
    return Math.random();
}

const cachedValue = null;
const value = cachedValue || expensiveOperation();
console.log(value); // expensiveOperation() is called

const cachedValue2 = 0.75;
const value2 = cachedValue2 || expensiveOperation();
console.log(value2); // 0.75 (expensiveOperation not called)

// ## 7. Array and Collection Operations

// ### Finding First Truthy Value in Array
const values = [0, "", null, undefined, false, "first truthy", "second truthy"];
const firstTruthy = values.find(val => val) || "No truthy values found";
console.log(firstTruthy); // "first truthy"

const allFalsy = [0, "", null, undefined, false];
const result = allFalsy.find(val => val) || "All values are falsy";
console.log(result); // "All values are falsy"

// ### Array Filtering with Fallbacks
const products = [
    { name: "Laptop", price: 1000 },
    { name: "Mouse", price: 0 }, // Free product
    { name: "Keyboard" }, // No price
    { name: "Monitor", price: 300 }
];

const productsWithPrice = products.map(product => ({
    ...product,
    price: product.price || "Price not set"
}));

console.log(productsWithPrice);
// [
//   { name: "Laptop", price: 1000 },
//   { name: "Mouse", price: "Price not set" },
//   { name: "Keyboard", price: "Price not set" },
//   { name: "Monitor", price: 300 }
// ]

// ## 8. DOM Manipulation and Event Handling

// ### Safe DOM Element Access
function getElement(selector) {
    return document.querySelector(selector) || createFallbackElement();
}

function createFallbackElement() {
    const div = document.createElement('div');
    div.textContent = 'Element not found';
    div.style.color = 'red';
    return div;
}

// Usage in event handlers
function handleClick(event) {
    const button = event.target || event.srcElement || document.activeElement;
    const text = button.textContent || "No text";
    console.log(`Clicked: ${text}`);
}

// ### Feature Detection
const storage = localStorage || sessionStorage || createMemoryStorage();

function createMemoryStorage() {
    const memory = {};
    return {
        setItem: (key, value) => memory[key] = value,
        getItem: (key) => memory[key],
        removeItem: (key) => delete memory[key]
    };
}

// Browser API detection
const geolocation = navigator.geolocation || {
    getCurrentPosition: (success, error) => {
        error("Geolocation not supported");
    }
};

// ## 9. Mathematical Operations

// ### Safe Division and Calculations
function safeDivide(a, b) {
    const divisor = b || 1; // Avoid division by zero
    return a / divisor;
}

console.log(safeDivide(10, 2));  // 5
console.log(safeDivide(10, 0));  // 10
console.log(safeDivide(10, null)); // 10

// Mathematical operations with defaults
function calculateTotal(price, quantity, taxRate) {
    const actualPrice = price || 0;
    const actualQuantity = quantity || 1;
    const actualTaxRate = taxRate || 0;
    
    return actualPrice * actualQuantity * (1 + actualTaxRate);
}

console.log(calculateTotal(100, 2, 0.1));  // 220
console.log(calculateTotal(null, 2, 0.1)); // 0
console.log(calculateTotal(100, null, 0.1)); // 110

// ## 10. Complex Business Logic

// ### User Permissions and Access Control
function checkUserAccess(user, requiredRole) {
    const userRole = user?.role || "guest";
    const userPermissions = user?.permissions || [];
    const hasRole = userRole === requiredRole;
    const hasPermission = userPermissions.includes(requiredRole);
    
    return hasRole || hasPermission || false;
}

const adminUser = { role: "admin", permissions: ["read", "write", "delete"] };
const editorUser = { role: "editor", permissions: ["read", "write"] };
const guestUser = {};

console.log(checkUserAccess(adminUser, "admin"));    // true
console.log(checkUserAccess(editorUser, "admin"));   // false
console.log(checkUserAccess(guestUser, "read"));     // false

// ### E-commerce Price Calculation
function calculateProductPrice(product, user) {
    const basePrice = product.price || 0;
    const discount = product.discount || user?.discount || 0;
    const taxRate = product.taxRate || 0.1; // 10% default tax
    
    const priceAfterDiscount = basePrice * (1 - discount);
    const finalPrice = priceAfterDiscount * (1 + taxRate);
    
    return finalPrice.toFixed(2);
}

const product = { price: 100, discount: 0.1 }; // 10% discount
const premiumUser = { discount: 0.15 }; // 15% user discount
const regularUser = {};

console.log(calculateProductPrice(product, premiumUser)); // 93.50
console.log(calculateProductPrice(product, regularUser)); // 99.00
console.log(calculateProductPrice({}, premiumUser));      // 0.00

// ## 11. Error Handling and Validation

// ### Input Validation Chain
function validateUserInput(input) {
    const errors = [];
    
    // Name validation
    const name = input.name?.trim() || "";
    if (!name) errors.push("Name is required");
    else if (name.length < 2) errors.push("Name must be at least 2 characters");
    
    // Email validation
    const email = input.email?.trim() || "";
    if (!email) errors.push("Email is required");
    else if (!email.includes("@")) errors.push("Invalid email format");
    
    // Age validation
    const age = input.age || 0;
    if (age < 18) errors.push("Must be 18 or older");
    
    return errors.length === 0 ? "Valid" : errors;
}

console.log(validateUserInput({}));
// ["Name is required", "Email is required", "Must be 18 or older"]

console.log(validateUserInput({ 
    name: "J", 
    email: "invalid", 
    age: 16 
}));
// ["Name must be at least 2 characters", "Invalid email format", "Must be 18 or older"]

// ### API Error Handling
async function apiCall() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        
        return {
            success: true,
            data: data || [],
            message: "Request successful"
        };
    } catch (error) {
        return {
            success: false,
            data: [],
            message: error.message || "Unknown error occurred",
            retryAfter: error.retryAfter || 5000
        };
    }
}

// Simulated error response
const errorResponse = {
    success: false,
    message: null
};

const message = errorResponse.message || "No error message provided";
console.log(message); // "No error message provided"

// ## 12. Advanced Patterns

// ### Conditional Object Properties
function createUserProfile(user, options = {}) {
    return {
        id: user.id || generateId(),
        name: user.name || "Anonymous",
        email: user.email,
        ...(options.includeMetadata && {
            createdAt: user.createdAt || new Date(),
            updatedAt: user.updatedAt || new Date()
        }),
        ...(options.includeSettings && {
            settings: user.settings || getDefaultSettings()
        })
    };
}

function generateId() { return Math.random().toString(36); }
function getDefaultSettings() { return { theme: "light" }; }

const user = { name: "John", email: "john@test.com" };
const profile = createUserProfile(user, { 
    includeMetadata: true, 
    includeSettings: true 
});

console.log(profile);

// ### Pipeline with Fallbacks
function processOrder(order) {
    const pipeline = [
        (order) => validateOrder(order) || throwError("Invalid order"),
        (order) => checkInventory(order) || restockProduct(order),
        (order) => calculateTotal(order) || applyDefaultPricing(order),
        (order) => processPayment(order) || retryPayment(order)
    ];
    
    return pipeline.reduce((result, step) => step(result) || result, order);
}

// Mock functions
function validateOrder(order) { return order.items ? order : null; }
function checkInventory(order) { return Math.random() > 0.5 ? order : null; }
function calculateTotal(order) { 
    order.total = order.items?.reduce((sum, item) => sum + (item.price || 0), 0) || 0;
    return order;
}
function processPayment(order) { return Math.random() > 0.3 ? { ...order, paid: true } : null; }

function restockProduct(order) { console.log("Restocking..."); return order; }
function applyDefaultPricing(order) { console.log("Applying default pricing..."); return order; }
function retryPayment(order) { console.log("Retrying payment..."); return { ...order, paid: true }; }
function throwError(msg) { throw new Error(msg); }

const order = { items: [{ name: "Product", price: 100 }] };
const result = processOrder(order);
console.log(result);

// ## Key Takeaways

// 1. **Short-circuit evaluation** - OR stops at first truthy value
// 2. **Default values** - Perfect for providing fallbacks
// 3. **Safe property access** - Avoid errors with nested objects
// 4. **Conditional execution** - Execute functions only when needed
// 5. **Configuration management** - Cascading configuration with fallbacks
// 6. **Performance** - Avoid expensive operations when possible
// 7. **Readability** - Cleaner code compared to if-else chains
// 8. **Functional programming** - Useful in pipelines and compositions

// The logical OR operator is one of the most versatile tools in JavaScript for handling default values, fallbacks, and conditional logic in a concise and readable way.








































// # JavaScript Logical AND (&&) Operator - Complete Scenarios

// ## 1. Basic Usage with Primitives

// ### Boolean Values
console.log(true && false);     // false
console.log(false && true);     // false
console.log(true && true);      // true
console.log(false && false);    // false

// ### String Values
console.log("hello" && "world");    // "world"
console.log("" && "world");         // ""
console.log("hello" && "");         // ""
console.log("" && "");              // ""

// ### Number Values
console.log(1 && 2);           // 2
console.log(0 && 2);           // 0
console.log(1 && 0);           // 0
console.log(NaN && 1);         // NaN

// ### null and undefined
console.log(null && "value");      // null
console.log(undefined && "value"); // undefined
console.log("value" && null);      // null
console.log("value" && undefined); // undefined

// ## 2. Practical Real-World Applications

// ### Conditional Property Access
// Safe nested object property access
const user = {
    profile: {
        name: "John",
        address: {
            city: "New York",
            zipcode: "10001"
        }
    }
};

const user2 = {};

// Get city if all properties exist
const city = user.profile && user.profile.address && user.profile.address.city;
console.log(city); // "New York"

const city2 = user2.profile && user2.profile.address && user2.profile.address.city;
console.log(city2); // undefined

// With optional chaining (ES2020+)
const city3 = user.profile?.address?.city;
console.log(city3); // "New York"

// ### Feature Flag Implementation
// Feature flags configuration
const featureFlags = {
    darkMode: true,
    betaFeatures: false,
    experimentalAPI: true
};

const user = {
    preferences: {
        theme: "dark"
    },
    isBetaTester: true
};

// Enable feature only when both flag and user permission exist
const canUseDarkMode = featureFlags.darkMode && user.preferences.theme === "dark";
const canUseBeta = featureFlags.betaFeatures && user.isBetaTester;
const canUseExperimental = featureFlags.experimentalAPI;

console.log("Dark Mode:", canUseDarkMode);        // true
console.log("Beta Features:", canUseBeta);        // false
console.log("Experimental:", canUseExperimental); // true

// ## 3. Node.js Development Scenarios

// ### Environment-Based Configuration
// config.js
const config = {
    database: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        username: process.env.DB_USER,
        password: process.env.DB_PASS
    },
    server: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development'
    }
};

// Only connect to database if all required configs are present
const canConnectToDB = config.database.host && 
                       config.database.port && 
                       config.database.username && 
                       config.database.password;

console.log("Database connection possible:", canConnectToDB);

// Safe database configuration
const dbConfig = canConnectToDB && {
    host: config.database.host,
    port: config.database.port,
    username: config.database.username,
    password: config.database.password
};

console.log(dbConfig); // null or configuration object

// ### Middleware Conditional Execution
// Express.js middleware example
function requireAuth(req, res, next) {
    const user = req.user;
    const isAuthenticated = user && user.isAuthenticated;
    const hasValidToken = user && user.token && !isTokenExpired(user.token);
    
    if (isAuthenticated && hasValidToken) {
        next(); // Continue to next middleware
    } else {
        res.status(401).json({ error: "Authentication required" });
    }
}

function isTokenExpired(token) {
    return false; // Simplified for example
}

// Simulated request object
const request = {
    user: {
        isAuthenticated: true,
        token: "abc123"
    }
};

// Mock middleware execution
requireAuth(request, { status: () => ({ json: console.log }) }, () => {
    console.log("User authenticated, proceeding...");
});

// ## 4. Conditional Function Execution

// ### Safe Method Calls
const api = {
    user: {
        getProfile: (id) => ({ name: "John", id: id }),
        updateProfile: (data) => console.log("Updating:", data)
    }
};

const api2 = {};

// Only call if method exists
const result = api.user && api.user.getProfile && api.user.getProfile(123);
console.log(result); // { name: "John", id: 123 }

const result2 = api2.user && api2.user.getProfile && api2.user.getProfile(123);
console.log(result2); // undefined

// Real-world example: Plugin system
const plugins = {
    analytics: {
        track: (event) => console.log(`Tracking: ${event}`)
    },
    logger: null // Plugin not loaded
};

// Safe plugin usage
plugins.analytics && plugins.analytics.track("page_view");
plugins.logger && plugins.logger.log("This won't execute");

// ### Validation Before Execution
function processUserData(user) {
    // Validate all required fields before processing
    const isValidUser = user && 
                       user.id && 
                       user.email && 
                       user.email.includes('@');
    
    return isValidUser && {
        id: user.id,
        email: user.email.toLowerCase(),
        name: user.name || 'Anonymous'
    };
}

console.log(processUserData({
    id: 1,
    email: "john@test.com",
    name: "John"
})); // { id: 1, email: "john@test.com", name: "John" }

console.log(processUserData({
    id: 2,
    email: "invalid-email"
})); // false

console.log(processUserData(null)); // false

// ## 5. DOM Manipulation and Event Handling

// ### Conditional Event Handling
// Safe DOM element manipulation
function initializeComponent(containerId) {
    const container = document.getElementById(containerId);
    
    // Only initialize if container exists and has required data attributes
    const canInitialize = container && 
                         container.dataset.component && 
                         !container.classList.contains('initialized');
    
    return canInitialize && {
        element: container,
        type: container.dataset.component,
        init: function() {
            console.log(`Initializing ${this.type} component`);
            container.classList.add('initialized');
        }
    };
}

// Simulated DOM elements
const mockDOM = {
    getElementById: (id) => id === 'app' ? {
        dataset: { component: 'calendar' },
        classList: { contains: () => false, add: console.log }
    } : null
};

const component = initializeComponent.call(mockDOM, 'app');
component && component.init(); // Executes

const invalidComponent = initializeComponent.call(mockDOM, 'nonexistent');
console.log(invalidComponent); // false

// ### Feature Detection
// Browser feature detection
const canUseLocalStorage = typeof localStorage !== 'undefined' && localStorage;
const canUseGeolocation = navigator && navigator.geolocation;
const canUseWebGL = document && document.createElement('canvas').getContext('webgl');

// Use features only if available
const storage = canUseLocalStorage && {
    set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
    get: (key) => JSON.parse(localStorage.getItem(key))
};

console.log("LocalStorage available:", !!storage);

// ## 6. Data Processing and Validation

// ### Data Pipeline Processing
function processOrder(order) {
    // Validate at each step, stop if any step fails
    const validatedOrder = validateOrder(order) && order;
    const pricedOrder = validatedOrder && calculatePrice(validatedOrder);
    const inventoryChecked = pricedOrder && checkInventory(pricedOrder);
    const finalOrder = inventoryChecked && applyDiscount(inventoryChecked);
    
    return finalOrder || null;
}

function validateOrder(order) {
    return order && order.items && order.items.length > 0;
}

function calculatePrice(order) {
    order.total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return order;
}

function checkInventory(order) {
    // Simulate inventory check
    return Math.random() > 0.1 ? order : null;
}

function applyDiscount(order) {
    if (order.total > 100) {
        order.discount = order.total * 0.1;
        order.finalTotal = order.total - order.discount;
    }
    return order;
}

const validOrder = { items: [{ price: 50, quantity: 2 }] };
console.log(processOrder(validOrder)); // Processed order or null

// ### Form Validation Chain
function validateRegistrationForm(formData) {
    const errors = [];
    
    // Validate each field only if previous validations pass
    const isNameValid = formData.name && formData.name.length >= 2;
    const isEmailValid = isNameValid && formData.email && formData.email.includes('@');
    const isPasswordValid = isEmailValid && formData.password && formData.password.length >= 8;
    const isAgeValid = isPasswordValid && formData.age && formData.age >= 18;
    
    !isNameValid && errors.push("Name must be at least 2 characters");
    !isEmailValid && errors.push("Valid email required");
    !isPasswordValid && errors.push("Password must be at least 8 characters");
    !isAgeValid && errors.push("Must be 18 or older");
    
    return errors.length === 0 ? "Valid" : errors;
}

console.log(validateRegistrationForm({
    name: "J",
    email: "invalid",
    password: "short",
    age: 16
}));
// ["Name must be at least 2 characters"]

console.log(validateRegistrationForm({
    name: "John",
    email: "john@test.com",
    password: "password123",
    age: 25
})); // "Valid"

// ## 7. Node.js API Development

// ### Request Validation Middleware
// Express.js route with validation
function createProduct(req, res) {
    const { name, price, category } = req.body;
    
    // Validate request body
    const isValidRequest = name && 
                          price && 
                          price > 0 && 
                          category && 
                          typeof name === 'string';
    
    if (!isValidRequest) {
        return res.status(400).json({ 
            error: "Invalid product data",
            required: ["name", "price", "category"]
        });
    }
    
    // Process valid request
    const product = {
        id: Date.now(),
        name: name.trim(),
        price: parseFloat(price),
        category: category.toLowerCase(),
        createdAt: new Date()
    };
    
    res.status(201).json(product);
}

// Simulated request
const mockRequest = {
    body: {
        name: "Laptop",
        price: 999.99,
        category: "Electronics"
    }
};

const mockResponse = {
    status: (code) => ({
        json: (data) => console.log(`Status ${code}:`, data)
    })
};

createProduct(mockRequest, mockResponse);

// ### Database Query Building
function buildUserQuery(filters) {
    const query = {};
    
    // Only add filters that are provided and valid
    filters.name && (query.name = { $regex: filters.name, $options: 'i' });
    filters.age && filters.age > 0 && (query.age = { $gte: filters.age });
    filters.email && (query.email = filters.email);
    filters.isActive && (query.isActive = filters.isActive === 'true');
    
    return Object.keys(query).length > 0 ? query : null;
}

console.log(buildUserQuery({
    name: "john",
    age: 25,
    email: "john@test.com"
}));
// { name: { '$regex': 'john', '$options': 'i' }, age: { '$gte': 25 }, email: 'john@test.com' }

console.log(buildUserQuery({})); // null

// ## 8. Error Handling and Fallbacks

// ### Graceful Error Recovery
function fetchWithFallback(primaryURL, fallbackURL) {
    try {
        // Try primary source first
        const primaryResponse = fetch(primaryURL);
        return primaryResponse && primaryResponse.data || 
               fetch(fallbackURL).data;
    } catch (error) {
        console.log("Primary failed, using fallback");
        return fetch(fallbackURL).data;
    }
}

// Mock fetch function
const fetch = (url) => ({
    data: url.includes('primary') ? { data: "from primary" } : { data: "from fallback" }
});

console.log(fetchWithFallback("primary", "fallback")); // { data: "from primary" }

// ### Configuration with Validation
class AppConfig {
    constructor(config) {
        this.database = config.database && {
            host: config.database.host || 'localhost',
            port: config.database.port || 5432,
            name: config.database.name || 'app_db'
        };
        
        this.api = config.api && {
            key: config.api.key,
            secret: config.api.secret,
            endpoint: config.api.endpoint || 'https://api.example.com'
        };
        
        this.features = config.features && {
            analytics: config.features.analytics || false,
            caching: config.features.caching || true
        };
    }
    
    isValid() {
        return this.database && this.database.host && this.api && this.api.key;
    }
}

const validConfig = new AppConfig({
    database: { host: "db.server.com", name: "myapp" },
    api: { key: "secret-key", endpoint: "https://api.test.com" },
    features: { analytics: true }
});

console.log(validConfig.isValid()); // true
console.log(validConfig.database); // { host: "db.server.com", port: 5432, name: "myapp" }

// ## 9. Advanced Patterns

// ### Permission-Based Access Control
function checkPermission(user, resource, action) {
    const permissions = {
        admin: {
            users: ['create', 'read', 'update', 'delete'],
            posts: ['create', 'read', 'update', 'delete']
        },
        editor: {
            posts: ['create', 'read', 'update'],
            comments: ['create', 'read', 'update', 'delete']
        },
        user: {
            posts: ['create', 'read'],
            comments: ['create', 'read', 'update']
        }
    };
    
    return user && 
           user.role && 
           permissions[user.role] && 
           permissions[user.role][resource] && 
           permissions[user.role][resource].includes(action);
}

const adminUser = { role: 'admin' };
const editorUser = { role: 'editor' };
const regularUser = { role: 'user' };

console.log(checkPermission(adminUser, 'users', 'delete')); // true
console.log(checkPermission(editorUser, 'users', 'delete')); // false
console.log(checkPermission(regularUser, 'posts', 'create')); // true
console.log(checkPermission(null, 'posts', 'read')); // false

// ### Builder Pattern with AND
class QueryBuilder {
    constructor() {
        this.filters = [];
    }
    
    where(field, value) {
        value && this.filters.push(`${field} = '${value}'`);
        return this;
    }
    
    andWhere(field, value) {
        value && this.filters.push(`AND ${field} = '${value}'`);
        return this;
    }
    
    build() {
        return this.filters.length > 0 ? 
               `SELECT * FROM table WHERE ${this.filters.join(' ')}` : 
               'SELECT * FROM table';
    }
}

const query = new QueryBuilder()
    .where('name', 'John')
    .andWhere('age', 25)
    .andWhere('city', '') // This won't be added
    .build();

console.log(query); // "SELECT * FROM table WHERE name = 'John' AND age = '25'"

// ## 10. Performance Optimization

// ### Lazy Loading with AND
class LazyLoader {
    constructor() {
        this._cache = {};
    }
    
    getResource(key, loaderFn) {
        // Only load if not cached and loader function provided
        return !this._cache[key] && loaderFn && (this._cache[key] = loaderFn());
    }
    
    getCached(key) {
        return this._cache[key];
    }
}

const loader = new LazyLoader();
const expensiveResource = loader.getResource('bigData', () => {
    console.log("Loading expensive resource...");
    return { data: "Expensive data" };
}); // "Loading expensive resource..." and returns data

const cachedResource = loader.getResource('bigData', () => {
    console.log("This won't execute");
}); // Returns cached data without executing

// ## Key Takeaways

// 1. **Short-circuit evaluation** - AND stops at first falsy value
// 2. **Conditional execution** - Execute code only when conditions are met
// 3. **Safe navigation** - Prevent errors with nested property access
// 4. **Validation chains** - Ensure multiple conditions are satisfied
// 5. **Performance** - Avoid unnecessary computations
// 6. **Readability** - Clean conditional logic without nested if statements
// 7. **Functional programming** - Useful in pipelines and compositions
// 8. **Error prevention** - Guard against null/undefined references

// The logical AND operator is essential for writing safe, efficient JavaScript code, especially in Node.js applications where you frequently deal with configuration, user input, and external data sources.















// # Real-World Use Cases of Comma Operator in Node.js Backend Development

// ## 1. Multiple Variable Declarations in One Line

// ### Configuration Setup
// Server configuration in one line
const port = process.env.PORT || 3000, 
      env = process.env.NODE_ENV || 'development',
      dbUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/app';

console.log(`Server running in ${env} mode on port ${port}`);

// Database connection setup
let client, db, collection;
try {
    client = await MongoClient.connect(dbUrl),
    db = client.db('app'),
    collection = db.collection('users');
    console.log('Database connected successfully');
} catch (error) {
    console.error('Database connection failed:', error);
}

// ### Request Processing
app.post('/api/users', async (req, res) => {
    let user, validationResult, savedUser;
    
    try {
        user = req.body,
        validationResult = validateUser(user),
        savedUser = await User.create(validationResult.validatedData);
        
        res.status(201).json(savedUser);
    } catch (error) {
        console.error('User creation failed:', error),
        res.status(400).json({ error: error.message });
    }
});

function validateUser(user) {
    let errors = [], validatedData = {};
    
    // Multiple validation checks in one expression
    !user.email && (errors.push('Email is required'), validatedData.email = null),
    user.email && !isValidEmail(user.email) && (errors.push('Invalid email'), validatedData.email = null),
    user.email && isValidEmail(user.email) && (validatedData.email = user.email.toLowerCase());
    
    return { errors, validatedData: errors.length === 0 ? user : validatedData };
}

// ## 2. Loop Operations with Multiple Updates

// ### Batch Processing
// Process multiple items in a single loop iteration
async function processUserBatch(users) {
    let processed = 0, failed = 0, results = [];
    
    for (let i = 0, user; i < users.length; i++) {
        user = users[i],
        console.log(`Processing user ${user.id}`),
        results.push(await processSingleUser(user).catch(error => 
            (failed++, { error: error.message }))),
        processed++;
    }
    
    return { processed, failed, results };
}

// Database cleanup operations
async function cleanupOldData() {
    let deletedUsers = 0, deletedSessions = 0, deletedLogs = 0;
    
    // Multiple cleanup operations in sequence
    await User.deleteMany({ lastActive: { $lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } })
        .then(result => deletedUsers = result.deletedCount),
    await Session.deleteMany({ expires: { $lt: new Date() } })
        .then(result => deletedSessions = result.deletedCount),
    await Log.deleteMany({ createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
        .then(result => deletedLogs = result.deletedCount);
    
    console.log(`Cleanup completed: ${deletedUsers} users, ${deletedSessions} sessions, ${deletedLogs} logs deleted`);
}

// ## 3. Middleware Chains and Express.js Applications

// ### Custom Middleware with Multiple Operations
// Logging middleware with multiple side effects
app.use((req, res, next) => {
    const startTime = Date.now(),
          originalSend = res.send;
    
    // Override res.send to log response time
    res.send = function(data) {
        const responseTime = Date.now() - startTime;
        console.log(`${req.method} ${req.path} - ${res.statusCode} - ${responseTime}ms`),
        originalSend.call(this, data);
    };
    
    next();
});

// Authentication middleware with multiple checks
const requireAuth = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', ''),
          user = token && verifyToken(token),
          isAllowed = user && hasPermission(user, req.path);
    
    !token && (console.log('No token provided'), res.status(401).json({ error: 'Authentication required' }), undefined),
    token && !user && (console.log('Invalid token'), res.status(401).json({ error: 'Invalid token' }), undefined),
    user && !isAllowed && (console.log('Insufficient permissions'), res.status(403).json({ error: 'Access denied' }), undefined),
    user && isAllowed && (req.user = user, next());
};

// ## 4. Database Transaction Operations

// ### MongoDB Transactions with Multiple Operations
async function transferFunds(fromUserId, toUserId, amount) {
    const session = await mongoose.startSession();
    let fromAccount, toAccount, transaction;
    
    try {
        await session.withTransaction(async () => {
            // Multiple database operations in one transaction
            fromAccount = await Account.findOneAndUpdate(
                { userId: fromUserId, balance: { $gte: amount } },
                { $inc: { balance: -amount } },
                { session, new: true }
            ),
            !fromAccount && (throw new Error('Insufficient funds'), undefined),
            
            toAccount = await Account.findOneAndUpdate(
                { userId: toUserId },
                { $inc: { balance: amount } },
                { session, new: true }
            ),
            !toAccount && (throw new Error('Recipient account not found'), undefined),
            
            transaction = await Transaction.create([{
                from: fromUserId,
                to: toUserId,
                amount: amount,
                type: 'transfer',
                status: 'completed'
            }], { session });
        });
        
        console.log(`Transfer completed: ${amount} from ${fromUserId} to ${toUserId}`),
        return { success: true, transaction };
    } catch (error) {
        console.error('Transfer failed:', error),
        return { success: false, error: error.message };
    } finally {
        session.endSession();
    }
}

// ## 5. Error Handling and Logging

// ### Comprehensive Error Handling
class ErrorHandler {
    static async handleAPIError(error, req, res) {
        const errorId = generateId(),
              timestamp = new Date().toISOString(),
              user = req.user?.id || 'anonymous';
        
        // Multiple logging operations
        console.error(`[${timestamp}] Error ${errorId}:`, error.message),
        await Log.create({
            errorId,
            message: error.message,
            stack: error.stack,
            userId: user,
            path: req.path,
            method: req.method,
            timestamp
        }),
        
        // Determine appropriate status code
        const statusCode = error.statusCode || 500,
              response = {
                  error: 'Internal Server Error',
                  message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
                  ...(process.env.NODE_ENV === 'development' && { stack: error.stack, errorId })
              };
        
        res.status(statusCode).json(response);
    }
}

// Usage in route handler
app.get('/api/data', async (req, res) => {
    try {
        const data = await fetchData(),
              processed = processData(data);
        res.json(processed);
    } catch (error) {
        ErrorHandler.handleAPIError(error, req, res);
    }
});

// ## 6. Cache Management

// ### Redis Cache Operations with Multiple Steps
class CacheManager {
    constructor(redisClient) {
        this.redis = redisClient;
    }
    
    async cacheUserData(userId) {
        let user, cacheKey, ttl;
        
        try {
            user = await User.findById(userId).populate('profile'),
            cacheKey = `user:${userId}`,
            ttl = 3600; // 1 hour
            
            // Multiple cache operations
            await this.redis.setex(cacheKey, ttl, JSON.stringify(user)),
            await this.redis.sadd('cached_users', userId),
            console.log(`User ${userId} cached successfully`);
            
            return user;
        } catch (error) {
            console.error('Cache operation failed:', error),
            return null;
        }
    }
    
    async batchInvalidateCache(pattern) {
        let keys = [], deletedCount = 0;
        
        // Find and delete multiple cache keys
        keys = await this.redis.keys(pattern),
        deletedCount = keys.length,
        deletedCount > 0 && await this.redis.del(...keys),
        console.log(`Invalidated ${deletedCount} cache keys matching ${pattern}`);
        
        return deletedCount;
    }
}

// ## 7. File Processing and Stream Operations

// ### File Upload Processing
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

app.post('/api/upload', upload.single('file'), async (req, res) => {
    let file = req.file, validationResult, processedData, dbResult;
    
    try {
        // Multiple file processing steps
        validationResult = validateFile(file),
        !validationResult.valid && (res.status(400).json({ errors: validationResult.errors }), undefined),
        
        processedData = await processUploadedFile(file.path),
        dbResult = await saveProcessedData(processedData),
        
        // Cleanup operations
        fs.unlinkSync(file.path),
        console.log(`File ${file.originalname} processed successfully`);
        
        res.json({ success: true, id: dbResult.id });
    } catch (error) {
        file && fs.existsSync(file.path) && fs.unlinkSync(file.path),
        console.error('File processing failed:', error),
        res.status(500).json({ error: 'File processing failed' });
    }
});

function validateFile(file) {
    let errors = [], maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    
    !file && errors.push('No file provided'),
    file && file.size > maxSize && errors.push('File too large'),
    file && !allowedTypes.includes(file.mimetype) && errors.push('Invalid file type');
    
    return { valid: errors.length === 0, errors };
}

// ## 8. Background Job Processing

// ### Queue Job Processing with Multiple Steps
const { Queue } = require('bull');

class EmailQueue {
    constructor() {
        this.queue = new Queue('email processing');
    }
    
    async processJob(job) {
        let template, user, emailData, result;
        
        try {
            // Multiple job processing steps
            job.progress(0),
            template = await EmailTemplate.findById(job.data.templateId),
            user = await User.findById(job.data.userId),
            
            job.progress(30),
            emailData = this.prepareEmailData(template, user, job.data.variables),
            
            job.progress(60),
            result = await this.sendEmail(user.email, emailData),
            
            job.progress(90),
            await EmailLog.create({
                userId: user.id,
                templateId: template.id,
                email: user.email,
                status: 'sent',
                sentAt: new Date()
            }),
            
            job.progress(100),
            console.log(`Email sent successfully to ${user.email}`);
            
            return result;
        } catch (error) {
            console.error('Email job failed:', error),
            await EmailLog.create({
                userId: job.data.userId,
                templateId: job.data.templateId,
                status: 'failed',
                error: error.message,
                attemptedAt: new Date()
            }),
            throw error;
        }
    }
}

// ## 9. API Response Formatting

// ### Response Building with Multiple Conditions
function formatAPIResponse(data, options = {}) {
    let response = {}, meta = {};
    
    // Build response with multiple optional fields
    options.includeMeta && (meta.timestamp = new Date().toISOString()),
    options.includeMeta && options.requestId && (meta.requestId = options.requestId),
    options.pagination && (meta.pagination = {
        page: options.pagination.page,
        limit: options.pagination.limit,
        total: options.pagination.total
    }),
    
    response.data = data,
    Object.keys(meta).length > 0 && (response.meta = meta),
    options.message && (response.message = options.message);
    
    return response;
}

// Usage in controller
app.get('/api/users', async (req, res) => {
    const page = parseInt(req.query.page) || 1,
          limit = parseInt(req.query.limit) || 10,
          skip = (page - 1) * limit;
    
    let users, total;
    
    try {
        users = await User.find().skip(skip).limit(limit),
        total = await User.countDocuments(),
        
        res.json(formatAPIResponse(users, {
            includeMeta: true,
            requestId: req.id,
            pagination: { page, limit, total },
            message: users.length === 0 ? 'No users found' : 'Users retrieved successfully'
        }));
    } catch (error) {
        console.error('Failed to fetch users:', error),
        res.status(500).json(formatAPIResponse(null, {
            message: 'Failed to fetch users'
        }));
    }
});

// ## 10. Testing and Test Setup

// ### Test Setup with Multiple Initializations
describe('User API', () => {
    let testUser, authToken, server;
    
    beforeAll(async () => {
        // Multiple test setup operations
        await mongoose.connect(process.env.TEST_DB_URI),
        server = app.listen(0), // Random port for tests
        
        testUser = await User.create({
            email: 'test@example.com',
            password: 'password123',
            name: 'Test User'
        }),
        authToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET);
    });
    
    afterAll(async () => {
        // Multiple cleanup operations
        await User.deleteMany({}),
        await mongoose.connection.close(),
        server.close();
    });
    
    beforeEach(async () => {
        // Reset state before each test
        await Order.deleteMany({}),
        await Session.deleteMany({}),
        console.log('Test database cleaned');
    });
    
    test('should create user order', async () => {
        let order, response;
        
        order = { items: [{ product: 'item1', quantity: 2 }], total: 100 },
        response = await request(server)
            .post('/api/orders')
            .set('Authorization', `Bearer ${authToken}`)
            .send(order),
        
        expect(response.status).toBe(201),
        expect(response.body.items).toHaveLength(1),
        expect(response.body.userId).toBe(testUser.id);
    });
});

// ## 11. Performance Monitoring

// ### Metrics Collection with Multiple Operations
class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
    }
    
    startOperation(name) {
        const startTime = Date.now(),
              memoryUsage = process.memoryUsage().heapUsed;
        
        this.metrics.set(name, { startTime, memoryUsage });
        return name;
    }
    
    endOperation(name) {
        const metric = this.metrics.get(name),
              endTime = Date.now(),
              duration = endTime - metric.startTime,
              memoryDiff = process.memoryUsage().heapUsed - metric.memoryUsage;
        
        // Multiple logging and recording operations
        console.log(`Operation ${name} took ${duration}ms, memory Δ: ${memoryDiff} bytes`),
        this.recordMetric(name, 'duration', duration),
        this.recordMetric(name, 'memory', memoryDiff),
        this.metrics.delete(name);
        
        return { duration, memoryDiff };
    }
    
    recordMetric(operation, type, value) {
        // Store metrics in database or send to monitoring service
        Metric.create({
            operation,
            type,
            value,
            timestamp: new Date()
        }).catch(error => console.error('Failed to record metric:', error));
    }
}

// Usage in route handler
app.get('/api/complex-operation', async (req, res) => {
    const opName = monitor.startOperation('complex_api_call');
    let data, processed;
    
    try {
        data = await fetchComplexData(),
        processed = await processData(data),
        monitor.endOperation(opName),
        res.json(processed);
    } catch (error) {
        monitor.endOperation(opName),
        console.error('Operation failed:', error),
        res.status(500).json({ error: 'Operation failed' });
    }
});






// ## Key Benefits in Node.js Backend Development

// 1. **Conciseness**: Reduce multiple lines of variable declarations into single expressions
// 2. **Sequential Operations**: Execute multiple operations in a specific order
// 3. **Loop Optimization**: Perform multiple operations in loop initializers/updaters
// 4. **Error Handling**: Group related cleanup operations
// 5. **Middleware Chains**: Execute multiple middleware operations sequentially
// 6. **Database Transactions**: Group related database operations
// 7. **Testing**: Simplify test setup and teardown operations
// 8. **Performance Monitoring**: Track multiple metrics in single expressions

// The comma operator is particularly valuable in Node.js for writing concise, sequential operations in middleware, database transactions, error handling, and test setup where multiple related operations need to be executed in order.