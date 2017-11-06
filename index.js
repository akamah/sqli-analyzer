var fs = require('fs');
var path = require('path');
var engine = require('php-parser');



function inspect(ast) {
  switch(ast.kind) {
  case 'program': 
    inspect_program(ast);
    break;
  case 'call':
    inspect_call(ast);
    break;
  }
}

function inspect_program(ast) {
  console.log('inspect program')
  ast.children.forEach(function(element) {
    inspect(element);
  }, this);
}


function is_sql_query_function(what) {
  if (what.kind == 'identifier') {
    return what.name == 'mysql_query';
  } else if (what.kind == 'propertylookup' && what.offset.kind == 'constref') {
    return what.offset.name == 'query';
  }

  return false;
}


function inspect_call(ast) {
  console.log('call.what ', ast.what)
  if (is_sql_query_function(ast.what)) {
    inspect_sql_query_string(ast.arguments[0]);
  }
}

function inspect_sql_query_string(ast) {
  console.log(ast);
}

// initialize a new parser instance
var parser = new engine({
  // some options :
  parser: {
    extractDoc: true
  },
  ast: {
    withPositions: true
  }
});


var buffer = 'hogehoge <?php $hoge->sqli->query("SELECT * from table where id = " . $var); ?>'

// Retrieve the AST from the specified source
var eval = parser.parseCode(buffer);

// Load a static file (Note: this file should exist on your computer)
// var phpFile = fs.readFileSync( './example.php' );
 
inspect(eval);

// Log out results
console.log('Eval parse:', eval);
// console.log(eval.kind)
// console.log( 'File parse:', parser.parseCode(phpFile) );
