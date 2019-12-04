(function() {
    var vm = new VirtualMachine(window.lc3os);

    var term = new Terminal();
    term.open(document.getElementById('term'));
    term.write('Choose a game to begin.\r\n');

    // MARK: - display

    var pending = '';

    vm.putChar = function(val) {
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

    // MARK: - input

    var availableChars = [];

    term.on('key', function(char, e) { // eslint-disable-line no-unused-vars
        if (char === '\r') char = '\n';

        availableChars.push(char.charCodeAt(0));
        vm.interrupt();
    });

    vm.hasChar = function() {
        return availableChars.length > 0;
    };

    vm.getChar = function() {
        if (availableChars.length > 0) {
            return availableChars.splice(0, 1)[0];
        }
        else {
            return 0;
        }
    };

    // MARK: - loading

    function begin(program) {
        term.clear();
        term.focus();

        vm.reset();
        availableChars = [];

        vm.loadOS();
        vm.load(program);
        // debugger
        vm.schedule();

    }

    window.begin = begin;
})();
