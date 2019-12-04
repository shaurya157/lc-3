class VirtualMachine{
  constructor(os){
    this.os = os;
    this.STEPS_PER_FRAME = 100000;
    this.EXIT_SUCCESS = true;
    this.EXIT_FAIL = false;
    this.EXIT_INPUT_TOO_LARGE = -1;
    this.EXIT_OPCODE_NOT_IMPLEMENTED = -2;
    this.EXIT_RETRY_AFTER_INTERRUPT = -3;
    this.retryAfterInterrupt = false;

    this.opcodes = {
      ADD: 0b0001,
      AND: 0b0101,
      BR : 0b0000,
      JMP: 0b1100,
      JSR: 0b0100,
      LD : 0b0010,
      LDI: 0b1010,
      LDR: 0b0110,
      LEA: 0b1110,
      NOT: 0b1001,
      RTI: 0b1000,
      ST : 0b0011,
      STI: 0b1011,
      STR: 0b0111,
      TRAP: 0b1111,
      RESERVED: 0b1101,
    }

    this.address = {
      INITIAL: 0x3000,
      KBSR: 0xfe00,
      KBDR: 0xfe02,
      DSR: 0xfe04,
      MCR: 0xfffe,
      DDR: 0xfe06,
      MAX:  0xffff,
    }

    this.pcReg = 8;
    this.psrReg = 9;
    this.countReg = 10;

    this.negativeFlag = 0b100;
    this.zeroFlag = 0b010;
    this.positiveFlag = 0b001;

    this.signBit = 1 << 15;
    this.statusBit = 1 << 15;

    this.reset();
  }

  swap16(value){
    return (value << 8) | (value >> 8);
  }

  extendSign(value, n){
    let x = 1 << (n - 1);
    value &= (1 << n) - 1;

    return (value ^ x) - x;
  }

  flagSign(value){
    if(value == 0){
      return this.zeroFlag;
    } else if (value & this.signBit){
      return this.negativeFlag;
    } else {
      return this.positiveFlag;
    }
  }

  reset(){
    this.memory = new Uint16Array(this.address.MAX + 1);
    this.register = new Uint16Array(this.countReg);

    this.register[this.pcReg] = this.address.INITIAL;
    this.register[this.psrReg] = this.zeroFlag;
    this.memory[this.address.MCR] = this.statusBit;

    this.retryAfterInterrupt = false;

    if(this.animationFrameHandle !== undefined){
      window.cancelAnimationFrame(this.animationFrameHandle);

      this.animationFrameHandle = undefined;
    }
  }

  schedule(){
    this.animationFrameHandle = window.requestAnimationFrame(() => this.step());
  }

  step(){
    // debugger
    let i = 0;
    while(i < this.STEPS_PER_FRAME){
      if(!(this.read(this.address.MCR) & this.statusBit)){
        return;
      }

      let instruction = this.read(this.register[this.pcReg]++);
      let result = this.execute(instruction);

      if(result == this.EXIT_RETRY_AFTER_INTERRUPT){
        this.register[this.pcReg]--;
        this.retryAfterInterrupt = true;
        return;
      } else if (result != this.EXIT_SUCCESS){
        return;
      }

      i++;
    }

    this.schedule();
  }

  interrupt(){
    if(this.retryAfterInterrupt){
      this.retryAfterInterrupt = false;
      this.schedule();
    }
  }

// IO
  putChar(value){
    console.log(value);
  }

  hasChar(){
    return false;
  }

  getChar(){
    return 0;
  }

  setCC(value){
    this.register[this.psrReg] = this.flagSign(this.register[value]);
  }

  assert(condition){
    if(!condition){
      debugger;
    }
  }

  loadOS(){
    let result = this.load(this.os);
    this.assert(result == this.EXIT_SUCCESS);
  }

  load(data){
    let arr = new Uint16Array(data.buffer);
    let loadAddress = this.swap16(arr[0]);
    let length = arr.length - 1;

    if(loadAddress + length > this.address.MAX){
      this.assert(0);
      return this.EXIT_INPUT_TOO_LARGE;
    }

    for (var i = 1; i < arr.length; ++i) {
        this.memory[loadAddress + i - 1] = this.swap16(arr[i]);
    }

    return this.EXIT_SUCCESS
  }

  write(address, value){
    if(address == this.address.KBSR || address == this.address.KBDR || address == this.address.DSR){
      //Might not need this, re-evaluate later
      assert(0)
    } else if(address == this.address.DDR){
      this.putChar(value);
    } else {
      this.memory[address] = value;
    }
  }

  read(address){
    if(address == this.address.KBSR){
      return this.hasChar() ? this.statusBit : 0;
    } else if(address == this.address.KBDR){
      if(this.hasChar()){
        return this.getChar();
      } else {
        return 0;
      }
    } else if(address == this.address.DSR){
      return this.statusBit;
    } else if(address == this.address.DDR){
      return 0;
    } else {
      return this.memory[address];
    }
  }

  execute(instruction){
    let destinationReg, sourceReg, sourceReg1, sourceReg2, im5, current, desired, offset, baseReg, trap;


    switch (instruction >> 12) {
      case this.opcodes.ADD:
        destinationReg = (instruction >> 9) & 0b111;
        sourceReg1 = (instruction >> 6) & 0b111;

        if(instruction & (1 << 5)) {
          im5 = this.extendSign(instruction, 5);
          this.register[destinationReg] = this.register[sourceReg1] + im5;
        } else {
          sourceReg2 = instruction & 0b111;
          this.register[destinationReg] = this.register[sourceReg1] + this.register[sourceReg2];
        }

        this.setCC(destinationReg);
        break;

      case this.opcodes.BR:
        current = this.register[this.psrReg] & 0b111;
        desired = (instruction >> 9) & 0b111;

        if(current & desired){
          offset = this.extendSign(instruction, 9);
          this.register[this.pcReg] += offset;
        }
        break;

      case this.opcodes.JMP:
        baseReg = (instruction >> 6) & 0b111;
        this.register[this.pcReg] = this.register[baseReg];

        break;
      case this.opcodes.LEA:
        destinationReg = (instruction >> 9) & 0b111;
        offset = this.extendSign(instruction, 9);

        this.register[destinationReg] = this.register[this.pcReg] + offset;

        this.setCC(destinationReg);
        break;

      case this.opcodes.STI:
        sourceReg = (instruction >> 9) & 0b111;
        offset = this.extendSign(instruction, 9);

        this.write(this.read(this.register[this.pcReg] + offset), this.register[sourceReg]);
        break;
      case this.opcodes.TRAP:
        trap = instruction & 0xff;

        if(trap == 0x20){
          if(this.hasChar()){
            this.register[0] = this.getChar();
          } else {
            return this.EXIT_RETRY_AFTER_INTERRUPT;
          }
        } else {
          this.register[7] = this.register[this.pcReg];
          this.register[this.pcReg] = this.read(trap);
        }
        break;

      case this.opcodes.JSR:
        this.register[7] = this.register[this.pcReg];

        if(instruction & (1 << 11)){
          offset = this.extendSign(instruction, 11);
          this.register[this.pcReg] += offset;
        } else {
          baseReg = (instruction >> 6) & 0b111;
          this.register[this.pcReg] = this.register[baseReg];
        }
        break;

      case this.opcodes.AND:
        destinationReg = (instruction >> 9) & 0b111;
        sourceReg1 = (instruction >> 6) & 0b111;

        if(instruction & (1 << 5)){
          im5 = this.extendSign(instruction, 5);
          this.register[destinationReg] = this.register[sourceReg1] & im5;
        } else {
          sourceReg2 = instruction & 0b111;
          this.register[destinationReg] = this.register[sourceReg1] & this.register[sourceReg2];
        }

        this.setCC(destinationReg);
        break;

      case this.opcodes.LD:
        destinationReg = (instruction >> 9) & 0b111;
        offset = this.extendSign(instruction, 9);

        this.register[destinationReg] = this.read(this.register[this.pcReg] + offset);

        this.setCC(destinationReg);
        break;

      case this.opcodes.NOT:
        destinationReg = (instruction >> 9) & 0b111;
        sourceReg = (instruction >> 6) & 0b111;

        this.register[destinationReg] = ~this.register[sourceReg];

        this.setCC(destinationReg);
        break;

      case this.opcodes.RTI:
        return this.EXIT_OPCODE_NOT_IMPLEMENTED;

      case this.opcodes.LDI:
        destinationReg = (instruction >> 9) & 0b111;
        offset = this.extendSign(instruction, 9);

        this.register[destinationReg] = this.read(this.read(this.register[this.pcReg] + offset));
        this.setCC(destinationReg);
        break;

      case this.opcodes.STR:
        sourceReg = (instruction >> 9) & 0b111;
        baseReg = (instruction >> 6) & 0b111;
        offset = this.extendSign(instruction, 6);

        this.write(this.register[baseReg] + offset, this.register[sourceReg]);
        break;

      case this.opcodes.RESERVED:
        return this.EXIT_OPCODE_NOT_IMPLEMENTED;

      case this.opcodes.ST:
        sourceReg = (instruction >> 9) & 0b111;
        offset = this.extendSign(instruction, 9);

        this.write(this.register[this.pcReg] + offset, this.register[sourceReg]);
        break;

      case this.opcodes.LDR:
        destinationReg = (instruction >> 9) & 0b111;
        baseReg = (instruction >> 6) & 0b111;
        offset = this.extendSign(instruction, 6);

        this.register[destinationReg] = this.read(this.register[baseReg] + offset);

        this.setCC(destinationReg);
        break;
      default:
        //TODO: revaluate this
        return this.EXIT_FAIL;
    }

    return this.EXIT_SUCCESS
  }
}
