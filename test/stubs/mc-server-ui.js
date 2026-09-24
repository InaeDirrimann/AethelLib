/**
 * test/stubs/mc-server-ui.js
 * Minimal stub for @minecraft/server-ui.
 */

export class ActionFormData {
    title()  { return this; }
    body()   { return this; }
    button() { return this; }
    async show() { return { canceled: true, selection: undefined }; }
}

export class MessageFormData {
    title()   { return this; }
    body()    { return this; }
    button1() { return this; }
    button2() { return this; }
    async show() { return { canceled: true, selection: undefined }; }
}

export class ModalFormData {
    title()     { return this; }
    textField() { return this; }
    toggle()    { return this; }
    dropdown()  { return this; }
    slider()    { return this; }
    async show() { return { canceled: true, formValues: [] }; }
}

export const FormCancelationReason = {
    UserBusy:   "UserBusy",
    UserClosed: "UserClosed",
};
