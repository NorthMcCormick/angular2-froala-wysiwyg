import { Directive, ElementRef, Renderer, Input, Output, Optional, EventEmitter } from '@angular/core';
import * as jQuery from "jquery";

@Directive({
  selector: '[froalaEditor]'
})
export class FroalaEditorDirective {

  // editor options
  private _opts: any = {
    immediateAngularModelUpdate: false,
    angularIgnoreAttrs: null
  };

  // jquery wrapped element
  private _jQueryelement: any;

  private SPECIAL_TAGS: string[] = ['img', 'button', 'input', 'a'];
  private INNER_HTML_ATTR: string = 'innerHTML';
  private _hasSpecialTag: boolean = false;

  // editor element
  private _editor: any;

  // initial editor content
  private _model: string;

  private _listeningEvents: string[] = [];

  private _editorInitialized: boolean = false;

  private _oldModel: string = null;

  constructor(el: ElementRef) {

    let element: any = el.nativeElement;

    // check if the element is a special tag
    if (this.SPECIAL_TAGS.indexOf(element.tagName.toLowerCase()) != -1) {
      this._hasSpecialTag = true;
    }

    // jquery wrap and store element
    this._jQueryelement = (<any>jQuery(element));
  }

  // froalaEditor directive as input: store the editor options
  @Input() set froalaEditor(opts: any) {
    this._opts = opts || this._opts;
  }

  // froalaModel directive as input: store initial editor content
  @Input() set froalaModel(content: string) {

    if (JSON.stringify(this._oldModel) == JSON.stringify(content)) {
      return;
    }
    this._model = content;

    if (this._editorInitialized) {
      this.setContent();
    }
  }
  // froalaModel directive as output: update model if editor contentChanged
  @Output() froalaModelChange: EventEmitter<any> = new EventEmitter<any>();

  // froalaInit directive as output: send manual editor initialization
  @Output() froalaInit: EventEmitter<Object> = new EventEmitter<Object>();

  // update model if editor contentChanged
  private updateModel() {

    let modelContent: any = null;

    if (this._hasSpecialTag) {

      let attributeNodes = this._jQueryelement[0].attributes;
      let attrs = {};

      for (let i = 0; i < attributeNodes.length; i++ ) {

        let attrName = attributeNodes[i].name;
        if (this._opts.angularIgnoreAttrs && this._opts.angularIgnoreAttrs.indexOf(attrName) != -1) {
          continue;
        }
        attrs[attrName] = attributeNodes[i].value;
      }

      if (this._jQueryelement[0].innerHTML) {
        attrs[this.INNER_HTML_ATTR] = this._jQueryelement[0].innerHTML;
      }

      modelContent = attrs;
    } else {

      let returnedHtml: any = this._jQueryelement.froalaEditor('html.get');
      if (typeof returnedHtml === 'string') {
        modelContent = returnedHtml;
      }
    }

    this._oldModel = modelContent;
    this.froalaModelChange.emit(modelContent);
  }

  // register event on jquery element
  private registerEvent(element, eventName, callback) {

    if (!element || !eventName || !callback) {
      return;
    }

    this._listeningEvents.push(eventName);
    element.on(eventName, callback);
  }

  private initListeners() {

    let self = this;

    // bind contentChange and keyup event to froalaModel
    this.registerEvent(this._jQueryelement, 'froalaEditor.contentChanged',function () {
      self.updateModel();
    });
    if (this._opts.immediateAngularModelUpdate) {
      this.registerEvent(this._editor, 'keyup', function () {
        self.updateModel();
      });
    }
  }

  // register events from editor options
  private registerFroalaEvents() {

    if (!this._opts.events) {
      return;
    }

    for (let eventName in this._opts.events) {

      if (this._opts.events.hasOwnProperty(eventName)) {
        this.registerEvent(this._jQueryelement, eventName, this._opts.events[eventName]);
      }
    }
  }

  private createEditor() {

    if (this._editorInitialized) {
      return;
    }

    this.setContent(true);

    // Registering events before initializing the editor will bind the initialized event correctly.
    this.registerFroalaEvents();

    // init editor
    this._editor = this._jQueryelement.froalaEditor(this._opts).data('froala.editor').jQueryel;

    this.initListeners();

    this._editorInitialized = true;
  }

  private setHtml() {
    this._jQueryelement.froalaEditor('html.set', this._model || '', true);

    //This will reset the undo stack everytime the model changes externally. Can we fix this?
    this._jQueryelement.froalaEditor('undo.reset');
    this._jQueryelement.froalaEditor('undo.saveStep');
  }

  private setContent(firstTime = false) {

    let self = this;
    // set initial content
    if (this._model || this._model == '') {
      this._oldModel = this._model;
      if (this._hasSpecialTag) {

        let tags: Object = this._model;

        // add tags on element
        if (tags) {

          for (let attr in tags) {
            if (tags.hasOwnProperty(attr) && attr != this.INNER_HTML_ATTR) {
              this._jQueryelement.attr(attr, tags[attr]);
            }
          }

          if (tags.hasOwnProperty(this.INNER_HTML_ATTR)) {
            this._jQueryelement[0].innerHTML = tags[this.INNER_HTML_ATTR];
          }
        }
      } else {
        if (firstTime) {
          this.registerEvent(this._jQueryelement, 'froalaEditor.initialized', function () {
            self.setHtml();
          });
        } else {
          self.setHtml();
        }

      }
    }
  }

  private destroyEditor() {
    if (this._editorInitialized) {
      this._jQueryelement.off(this._listeningEvents.join(" "));
      this._editor.off('keyup');
      this._jQueryelement.froalaEditor('destroy');
      this._listeningEvents.length = 0;
      this._editorInitialized = false;
    }
  }

  private getEditor() {
    if (this._jQueryelement) {
      return this._jQueryelement.froalaEditor.bind(this._jQueryelement);
    }

    return null;
  }

  // send manual editor initialization
  private generateManualController() {
    let self = this;
    let controls = {
      initialize: this.createEditor.bind(this),
      destroy: this.destroyEditor.bind(this),
      getEditor: this.getEditor.bind(this),
    };
    this.froalaInit.emit(controls);
  }

  // TODO not sure if ngOnInit is executed after @inputs
  ngOnInit() {

    // check if output froalaInit is present. Maybe observers is private and should not be used?? TODO how to better test that an output directive is present.
    if (!this.froalaInit.observers.length) {
      this.createEditor();
    } else {
      this.generateManualController();
    }
  }

  ngOnDestroy() {
    this.destroyEditor();
  }
}

@Directive({
  selector: '[froalaView]'
})
export class FroalaViewDirective {

  private _element: HTMLElement;
  private _content: any;

  constructor(private renderer: Renderer, element: ElementRef) {
    this._element = element.nativeElement;
  }

  // update content model as it comes
  @Input() set froalaView(content: string){
    this._element.innerHTML = content;
  }

  ngAfterViewInit() {
    this.renderer.setElementClass(this._element, "fr-view", true);
  }
}