(function() {
    var virtualMachine = new VirtualMachine(window.lc3os);

    var term = new Terminal();
    term.open(document.getElementById('term'));
    term.write('Choose a game to begin.\r\n');


    var pending = '';

    virtualMachine.putChar = function(val) {
        var char = String.fromCharCode(val);
        if (char === '\n') char = '\r\n';
        // console.log(val);
        if (pending.length == 0) {
            window.requestAnimationFrame(() => {
                term.write(pending);
                // console.log(pending);
                pending = [];
            });
        }

        pending += char;
    };



    var availableChars = [];

    term.on('key', function(char, e) {
        if (char === '\r') char = '\n';

        availableChars.push(char.charCodeAt(0));
        virtualMachine.interrupt();
    });

    virtualMachine.hasChar = function() {
        return availableChars.length > 0;
    };

    virtualMachine.getChar = function() {
        if (availableChars.length > 0) {
            return availableChars.splice(0, 1)[0];
        }
        else {
            return 0;
        }
    };

    function begin(program) {
        term.clear();
        term.focus();

        virtualMachine.reset();
        availableChars = [];

        virtualMachine.loadOS();
        virtualMachine.load(program);
        virtualMachine.schedule();

    }

    window.begin = begin;
})();
