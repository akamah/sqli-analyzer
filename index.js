var path = require('path');
var engine = require('php-parser');


//////////// traversing AST
function inspect(ast) {
  if (!ast) {
    return;
  }
  
  // 
  if (ast.hasOwnProperty('children')) {
    inspect_body(ast.children);
  }
  if (ast.hasOwnProperty('body')) {
    inspect_body(ast.body);
  }
  if (ast.hasOwnProperty('alternate')) {
    inspect_body(ast.alternate);
  }
  if (ast.hasOwnProperty('right')) {
    inspect(ast.right);
  }
  if (ast.hasOwnProperty('test')) {
    inspect(ast.test);
  }
  if (ast.hasOwnProperty('what')) {
    inspect(ast.what);
  }

  if (ast.kind === 'call') {
    inspect_call(ast);
  }
}

// body ::= block | null | array<decl> | stmt | array<node>
function inspect_body(body) {
  //  console.log(ast)
  if (body == null || body == false) { 
    return;
  } else if (Array.isArray(body)) {
    body.forEach(function(element) {
      inspect(element);
    }, this);
  } else {
    inspect(body);
  }
}

//////////// utility functions to inspect AST
function is_global_function_call(what) {
  return what.kind === 'identifier';
}

function is_propertylookup(what) {
  return what.kind === 'propertylookup' && 
  what.offset.kind === 'constref';
}

function is_old_mysql_api(what) {
  if (is_global_function_call(what)) {
    return ['mysql_query', 'mysql_escape_string', 'mysql_real_escape_string', 'mysql_set_charset'].includes(what.name);
  }
  return false;
}

function inspect_sql_query_function(ast) {
  var what = ast.what;
  if (is_global_function_call(what)) {
    if (['mysqli_query'].includes(what.name)) {
      inspect_sql_query_string(ast.arguments[1]);
    }
  } else if (is_propertylookup(what)) {
    if (['query'].includes(what.offset.name)) {
      inspect_sql_query_string(ast.arguments[0]);
    }
  }
  return false;
}

function inspect_encoding_function(ast) {
  var what = ast.what;
  if (is_global_function_call(what)) {
    if (['mysqli_set_charset'].includes(what.name)) {
      encoding_have_set = true;
    }
  } else if (is_propertylookup(what)) {
    if (what.offset.name === 'set_charset') {
      encoding_have_set = true;
    }
  }
  return false;
}

function is_sql_escape_function(what) {
  if (is_global_function_call(what)) {
    return ['mysqli_escape_string', 'mysqli_real_escape_string'].includes(what.name);
  } else if (is_propertylookup(what)) {
    return ['real_escape_string', 'escape_string'].includes(what.offset.name);
  }
  return false;
}

var encoding_have_set = false;


/////// inspect inside function call
function inspect_call(ast) { 
  if (is_old_mysql_api(ast.what)) {
    alert_vulnerability(ast, "old mysql call is deprecated. use mysqli");
    return;
  }
  
  inspect_sql_query_function(ast);
  inspect_encoding_function(ast);
}

/** flatten linked list of boolean operator `.'
* @param ast: AST of the first argument of sql-query functions
* @returns: array of each element
*/
function flatten_string_concatenation(ast) {
  if (ast.kind === 'bin' && ast.type === '.') {
    var rest = flatten_string_concatenation(ast.left);
    return rest.concat(flatten_string_concatenation(ast.right));
  } else if (ast.kind === 'encapsed') {
    // unfold encapsed string, like "hello, {$name}!"
    return ast.value.reduce(function(prev, current, index, arr) {
      return prev.concat(flatten_string_concatenation(current));
    }, []);
  } else if (ast.kind === 'parenthesis') {
    // (hoge) => hoge
    return flatten_string_concatenation(ast.inner);
  } else {
    return [ast];
  }
}

var karma = 0;
var alert_output = "";

function alert_vulnerability(ast, msg) {
  var loc = "unknown";

  if (ast) {
    loc = ast.loc.start.line + ":" + ast.loc.start.column;
  }

  alert_output += `WARNING at line ${loc}: ` + msg + "\n";
  karma += 1;
}

function report_total_result() {
  if (karma === 0) {
    alert_output += "RESULT: OK";
  } else {
    alert_output += `RESULT: ${karma} warnings`;
  }
  
  console.log(alert_output);  

  var tmp = alert_output;
  alert_output = "";
  karma = 0;

  return tmp;
}

// check surrounding strings are good for escaping
// only simple checks are done in this step
function inspect_escaping_strings(left, right, value) {  
  if (left === undefined) {
    alert_vulnerability(value, "bad variable position"); 
    return;   
  }
  if (right === undefined) {
    alert_vulnerability(value, "bad variable position");    
    return;
  }
  if (left.kind !== 'string') {
    alert_vulnerability(left, "expression before variable is not string");    
    return;
  }
  if (right.kind !== 'string') {
    alert_vulnerability(right, "expression before variable is not string");    
    return;
  }
  
  var l = left.value;
  var r = right.value;
  
  if (l[l.length - 1] === "'" && l[l.length - 2] === "'") {
    alert_vulnerability(left, "variable is doubly single quoted");
    return;    
  }
  if (l[l.length - 1] === '"' && l[l.length - 2] === '"') {
    alert_vulnerability(left, "variable is doubly double quoted");    
    return;
  }

  if ((l[l.length - 1] === "'" && r[0] === "'") ||
  (l[l.length - 1] === "'" && r[0] === "'")) {
    return;
  } else {
    alert_vulnerability(left, "variable is not properly escaped by enclosing strings");
  }
}

// inspect the first argument of sql_query function
function inspect_sql_query_string(ast) {
  if (!ast) {
    alert_vulnerability(ast, "query argument is null");
    return;
  }

  if (!encoding_have_set) {
    alert_vulnerability(ast, "encoding is not set before sql query");
  }

  var flatten = flatten_string_concatenation(ast);
  
  flatten.forEach(function(value, index, array) {
    if (value.kind === 'string') {
      // ok
    } else if (value.kind === 'call' && is_old_mysql_api(value.what)) {
      alert_vulnerability(value, 'calling old escape function. use mysqli');
    } else if (value.kind === 'call' && is_sql_escape_function(value.what)) {
      var left = array[index - 1]; // get surrounding string 
      var right = array[index + 1];
      
      inspect_escaping_strings(left, right, value);
    } else {
      alert_vulnerability(value, 'value is not escaped');
    }
  }, this);
  
}

function main(buffer) {
  // initialize a new PHP parser
  var parser = new engine({
    // some options :
    parser: {
      extractDoc: true
    },
    ast: {
      withPositions: true
    }
  });
    
  try {
    var ast = parser.parseCode(buffer, "input");
    inspect(ast);
    return report_total_result();
  } catch (e) {
    var msg = `ERROR: syntax error in '${e.fileName}' at ${e.lineNumber}:${e.columnNumber}\n`;
    msg += `ERROR: no analysis done`;
    
    console.log(e);
    return msg;
  }
}

// read strings from stdin then inspect
//if (typeof document === 'undefined') {
//  var fs = require('fs');
//  main(fs.readFileSync('/dev/stdin', 'utf8'));
//}

function execute() {
  var in_str = document.getElementById('input').value;
  var result = main(in_str);

  document.getElementById('output').value = result;
}

(function() {
  window.onload = function() {
    document.getElementById('fire').addEventListener('click', execute);
  }
})();

