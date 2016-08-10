// FASTI: Force-directed Abstract Syntax Tree Interpreter 
// Copyright (C) 2016 Charles Li

(function () {
    "use strict";
    var canvas = document.getElementById("myCanvas");
    var ctx = canvas.getContext("2d");
/*******                Data                     ******/

    var tokenArray = [];
    var ast = [];

    var curNode;

/*******         Vector Library                      ******/
    function vector(x, y) {
        if ( !(this instanceof vector) ) { // dont need new
           var new_vec = new vector(x, y);
           return new_vec;
        }
        this.x = x || 0;
        this.y = y || 0;
    };

	vector.prototype.neg = function() {
		return new vector(this.x * -1, this.y * -1 );
	};

	vector.prototype.add = function(vecArg) {
        return new vector(this.x + vecArg.x, this.y + vecArg.y);
	};
    
	vector.prototype.subtract = function(v2) {
		return new vector(this.x - v2.x, this.y - v2.y);
	};

	vector.prototype.multiply = function(n) {
		return new vector(this.x * n, this.y * n);
	};
    
	vector.prototype.divide = function(n) {
		return new vector( (this.x / n) || 0,
                           (this.y / n) || 0);
	};
    
	vector.prototype.magnitude = function() {
		return Math.sqrt(this.x * this.x + this.y * this.y);
	};

	vector.prototype.magnitudeSquared = function() {
		return this.x * this.x + this.y * this.y;
	};
    
	vector.prototype.normalize = function() {
		return this.divide(this.magnitude());
	};

    var deltaRightVector = new vector(77,0);
    var deltaDownVector = new vector(0,77);

/*******                Graphics                      ******/
    var drawText = function(myStr, posVector) {
        ctx.font = "25px Arial";
        ctx.fillStyle = "OrangeRed";  // http://www.w3schools.com/cssref/css_colors.asp
        ctx.fillText(myStr, posVector.x, posVector.y+20);
    };

    var drawRect = function(position, color) {
        ctx.fillStyle = color;
        ctx.fillRect(position.x, position.y, 45, 45);
    };

    var drawLine = function(position1, position2) {
        ctx.beginPath();
        ctx.moveTo(position1.x, position1.y);
        ctx.lineTo(position2.x, position2.y);
        ctx.strokeStyle = "white";
        ctx.stroke();
    };
    
/*******                Parser                      ******/
    var categorize = function(curToken){
        if ( !isNaN(curToken) ) {
            return { type : "number" , value : parseFloat(curToken) };
        } else {
            return { type : "identifier", value : curToken };
        }
    };
    
    var parenthesize = function(tokenList) {
        var retArray = [];
        while( tokenList.length ) {
            var curToken = tokenList.shift();
            if(curToken === "(") { 
                retArray.push( { type : "expr" , value : "()", sexpr : parenthesize(tokenList) } ); // recursive
            } else if(curToken === ")") {
                return retArray;
            } else {
                retArray.push( categorize(curToken) );
                console.log("parenthesize ", retArray);
            }
        }
        return retArray;
    };

/*******                Library                      ******/
    var library = {
        "+" : function*(x, y) { // same type as Lambda closure
            //  return x + y;
                var sum = 0;
                for(var i = 0; i < arguments.length; i++) {
                    sum += arguments[i];
                }
                return sum;
        },
        "-" : function*(x, y) {
            return (x - y);
        },
        "*" : function*(x, y) {
            console.log("x * y :", x, y);
            return (x * y);
        },
        "/" : function*(x, y) {
            console.log("x / y :", x, y);
            return (x / y);
        },
        "<" : function*(x, y) {
            console.log("x < y :", x, y);
            return (x < y);
        },
    };
    
    var Context = function(scope, parent) {
        this.scope = scope;
        this.parent = parent;
        /*
        this.get = function(identifier){
          if (identifier in this.scope) {
              return this.scope[identifier];
          } else if (this.parent !== undefined) {
              return this.parent.get(identifier); // recursive to the top.
          }
        };
        */
        this.get = function(identifier) {
            var curEnv = this;
            while(curEnv !== undefined) {
                var curScope = curEnv.scope;
                if (identifier in curScope) {
                    return curScope[identifier];
                }
                curEnv = curEnv.parent;
            }
        };
    };

    var ContextList = []; // array of Context for visualization

/*******                Interpreter                      ******/
    var interpretList = function*(input, context) {
        if (context === undefined) { // first time in, create primative library
            var firstContext  = new Context(library);
            var secondContext = new Context( {} , firstContext);
            ContextList.push( firstContext );
            ContextList.push( secondContext );
            var finalResult = yield* interpretList (input, secondContext ); // Recurse -- load lib
            ContextList.pop; // pop second context
            return finalResult;
        } else if (input[0].value === "if") { // special form
            input[1].result = yield* interpret( input[1], context );
            if ( input[1].result ) { // Recurse
                input[2].result = yield* interpret( input[2], context ); // Recurse consequence
                return input[2].result;
            } else {
                input[3].result = yield* interpret( input[3], context ); // Recurse alternative
                return input[3].result;
            }
        } else if (input[0].value === "define") {
            context.scope[input[1].value] = yield* interpret(input[2], context);
            console.log("defining:", context)
            return;
        } else if (input[0].value === "lambda") { // special form
            return function* () { // closure
                var formalArg = input[1].sexpr;
                var actualArg = arguments;

                if (formalArg.length !== actualArg.length) {
                    console.error("Lambda call binding failed", formalArg, actualArg, input[2]);
                }
                var localEnv = {};
                for(var i = 0; i < arguments.length; i++) {
                    localEnv[formalArg[i].value] = actualArg[i]; // bind 
                }
                var localContext = new Context(localEnv, context); // chain it with previous Env
                ContextList.push( localContext ); // add lambda context to the list
                var lambdaResult = yield* interpret(input[2], localContext); // Recurse
                ContextList.pop(); // must match push
                return lambdaResult;
            }
        } else { // non-special form
            var list  = []; // for loop alternative to map
            for(var i = 0 ; i < input.length; i++) {
                list[i] = yield* interpret(input[i], context);
            }
            
            if (list[0] instanceof Function) { // apply JS function <========== THIS NEEDS TO CHANGE FOR GENERATOR
                console.log("functions:", list[0]);
                //return list[0].apply(undefined, list.slice(1)); // apply: each list element becomes an actual arg
                var proc = list.shift(); // Remove first element from array and return that element
                var args = list;  // shifted list
                return yield* proc.apply(undefined, args); // apply: each list element becomes an actual arg 
            } else {
                return list;
            }
        }
    };

    var interpret = function* (input, context) {
        curNode = input; // used for visualizer
        if (input.type === "expr") { // Expression
             input.result = yield* interpretList(input.sexpr, context); // Recurse
             yield;
             return input.result;
        } else if (input.type === "identifier") { // Variable
            input.result = context.get(input.value);
            yield;
            return input.result;
        } else if (input.type === "number") { // Literal
            input.result = input.value;
            yield;
            return input.result;
        } else {
            console.error("Warning: interpret do not recognize atom type: ", input.type);
        }
    };

/*******                Visualizer                      ******/
    var initPvaList = function(input, position) {
        var curPosition = position;
        for(var i = 0; i < input.length; i++){
            initPva(input[i], curPosition);
            curPosition = curPosition.add(deltaRightVector);
        }
    };

    var initPva = function(input, position) {
        // Init Position, Velocity, Acceleration
        if (input.pos === undefined) {
            input.pos = new vector(position.x, position.y);
        }
        if (input.v === undefined) {
            input.v = new vector(0,0);
        }
        if (input.a === undefined) {
            input.a = new vector(0,0);
        }

        if (input.type === "expr") {
            initPvaList(input.sexpr, position.add(deltaDownVector) );  // recurse
        }
    };

    var visualizeEnv = function() {
        for (var i = 0; i < ContextList.length; i++) {
            var x_loc = 20;
            for (var key in ContextList[i].scope) {
                 var keyValPair = key;
                 if( typeof ContextList[i].scope[key] !== "function" ) {
                    keyValPair = key + " : " + ContextList[i].scope[key]; // display value if not a function
                 }
                 drawText(keyValPair, {x:x_loc, y:30*i + 50} );

                 x_loc += 100;
            }
        } 
    };


// Drawing AST
    var visualizeList = function(input, parent) {
        for(var i = 0; i < input.length; i++){
            if (parent !== undefined) {
                drawLine(input[i].pos, parent.pos);
            }
            visualize(input[i]);
        }
    };

    var visualize = function(input) {
        var color = "white";
        
        if (input === curNode) {
            color = "red"; // highlight currently interpreting node red
        } else {
            color = "yellow";
        }
        
        drawRect(input.pos, color);
        drawText(input.value, input.pos);

        if (input.result !== undefined && 
            !(input.result instanceof Function) ) { // ignor functions
            drawText(input.result, input.pos.add( new vector(0,22) )); // draw result text
        }
            
        if (input.type === "expr") {
            visualizeList(input.sexpr, input);  // recurse
        }
    };

// Position
    var timestep = 0.01; // Time Step -- super important
    var updatePosition = function(input) {
        input.pos = input.pos.add( input.v.multiply(timestep) ); // Update pos += v*t

        if(input.type === "expr") {
            updatePositionList(input.sexpr); // Recurse Sub-Expression
        }
    };
    var updatePositionList = function(input) {
        for(var i = 0; i < input.length; i++){
            updatePosition(input[i]);
        }
    };

// Velocity
    var damping = 0.9;
    var updateVelocity = function(input) {
        input.v = input.v.add( input.a.multiply(timestep) ); // Core

        input.v = input.v.multiply(damping); // damping
        input.a = input.a.multiply(damping); // ~2-3% surplus acceleration

        if(input.type === "expr") {
            updateVelocityList(input.sexpr); // Recurse Sub-Expression
        }
    };
    var updateVelocityList = function(input) {
        for(var i = 0; i < input.length; i++){
            updateVelocity(input[i]);
        }
    };

// Hooke's law: F = -kX
    var springLength = 50;  // default length of springs // Parameter tweak
    var springConstant = 1; // Parameter tweak
    var applySpring = function(inputA, inputB) {
        var d = inputB.pos.subtract(inputA.pos);
        var displacement = d.magnitude() - springLength;
        var direction = d.normalize();

        var delta_a = direction.multiply(springConstant * displacement * 0.5 )

        inputA.a = inputA.a.add( delta_a );       // core
        inputB.a = inputB.a.add( delta_a.neg() ); // core
    };
    var springList = function(input, parent) {
        if(parent !== undefined){ // firest entry no parent
            for(var i = 0; i < input.length; i++) {
                applySpring(input[i], parent); // apply spring from parent to each child
            }
        }

        for(var i = 1; i < input.length; i++) {
            applySpring(input[i-1], input[i-0]); // horizontal spring between children
        }
            
        for(var i = 0; i < input.length; i++) {
            if (input[i].type === "expr") {
                springList(input[i].sexpr, input[i]); // Recurse - remember parent
            }
        }
    };


// Coulomb's law: F = k q1 q2 / r^2
    var chargeConstant = 50000; // k  // Parameter tweak
    var applyRepulsion = function(inputA, inputB){
        var distance = inputB.pos.subtract(inputA.pos); // TODO: when input1 and input2 pos overlap
        var distance_magSquared = distance.magnitudeSquared(); // denominator
        var direction = distance.normalize(); // unit length

        var delta_acc = direction.multiply(0.5 * chargeConstant / (distance_magSquared + 50 ) );   // Parameter tweak 
        inputA.a = inputA.a.add( delta_acc.neg() );  // Apply acceleration to A
        inputB.a = inputB.a.add( delta_acc );        // Apply acceleration to B
        return;
    };
    var repelAtom = function(input, other) { // other holds first time transversal input
        if(other === undefined) {  // 1st transveral 
            repelList(ast, input); // transverse AST again for each node - O(N^2)
        } else { // 2nd transversal - other holds current node
            if(input !== other){
                applyRepulsion(input, other); // apply electrostatic force between each node with every other node
            }
        }

        if(input.type === "expr") {
            repelList(input.sexpr, other); // recurse
        }
    };
    var repelList = function(input, other) {
        for(var i = 0; i < input.length; i++){
            repelAtom(input[i], other);
        }
    };

/*******                Main                ******/    
/*******                Main                ******/
/*******                Main                ******/

    function main(){
        //var sourceCode = "( ( define foo ( lambda (a b) (+ a b) ) ) (foo 1 2) )";
       
        var sourceCode = "( ( define fib                            " +
                         "    ( lambda (x)                          " + 
                         "             ( if ( < x 2 )               " +  
                         "                  x                       " + 
                         "                  (* x ( fib (- x 1) )  ) " +
                         "  ) )        )                            " +
                         "  ( fib 5 )                               " +
                         ")";
       
        //var sourceCode = "( ( lambda (x) x ) 3 )";
        //var sourceCode = "(+ 3 5)";
        //var sourceCode = "(1 2 3)";
        //var sourceCode = "(/ 6 3)";

        tokenArray = sourceCode.replace(/\(/g, " ( ")
                               .replace(/\)/g, " ) ")
                               .trim()
                               .split(/\s+/);
        ast = parenthesize(tokenArray);

        var maxFrame = 10000; // <= number of Frames before Visualization stops

        var frame = 0;
        var drawCall = function() { // core
           
            if(frame > maxFrame) { // 1st Method - Stop
                window.clearInterval(drawIntervalID);
            }
            
            
            //console.log("drawCall", frame); // top left frames
            ctx.clearRect(0, 0, canvas.width, canvas.height); // clear screen
            /*
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            */
            
            drawText("Frame: " + frame, {x:30, y:30}); // frame counter upper left

            initPvaList(ast, new vector(canvas.width/5,  canvas.height/5) ); // initialize Position, Velocity, Acceleration
            visualizeEnv(); // draw "Context" aka symbol tables
            visualizeList(ast); // draw AST
            springList(ast); // O(N)
            repelList(ast);  // O(N^2)
            updatePositionList(ast);
            updateVelocityList(ast);
            frame++;

            /*
            if(frame < maxFrame) { // 2nd Method - Stop
                window.requestAnimationFrame(drawCall);
            }
            */
            return;
        };

        var drawIntervalID = window.setInterval(drawCall, 5); // 1st Method Start (2nd arg in millisecond)
        //drawCall(); // 2nd Method - Start

// Interpret change from function to function generator
        //  var final_res = interpretList(ast); // core - start with array
        //  console.log(">>> Final Result: ", final_res);

        var gen = interpretList(ast);
        /*
        var step = gen.next();
        while(!step.done) {
            gen.next()
        }
        console.log(">>> Final Result: ", step.result);
        */

        var interpretLoop = function() {
            var step = gen.next();
            if(!step.done){
                console.log(">>> Not Done: ", step.result);
                window.setTimeout(interpretLoop, 500);  // interpreter timeout
            } else {
                console.log(">>> Final Result: ", step.result);
            }
        };

        interpretLoop();
        

        return;
    }

    document.addEventListener('DOMContentLoaded', main, false); // start when ready
}) ();
