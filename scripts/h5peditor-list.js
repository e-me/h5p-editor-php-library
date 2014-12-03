/** @namespace H5PEditor */
var H5PEditor = H5PEditor || {};

H5PEditor.List = (function ($) {

  /**
   * List structure.
   *
   * @class
   * @param {*} parent structure
   * @param {Object} field Semantic description of field
   * @param {Array} [parameters] Default parameters for this field
   * @param {Function} setValue Call to set our parameters
   */
  function List(parent, field, parameters, setValue) {
    var self = this;

    // Set default editor widget
    self.default = {
      name: 'ListEditor',
      label: H5PEditor.t('core', 'editorListLabel')
    };

    // Initialize semantics structure inheritance
    H5PEditor.SemanticStructure.call(self, field);

    // Make it possible to travel up three.
    self.parent = parent; // (Could this be done a better way in the future?)

    /**
     * Keep track of child fields. Should not be exposed directly,
     * create functions for using or finding the children.
     *
     * @private
     * @type {Array}
     */
    var children = [];

    // This fields labels. Used in error messages.
    var label = (field.label === undefined ? field.name : field.label);

    // Prepare the old ready callback system
    var readyCallbacks = [];
    var passReadyCallbacks = true;
    parent.ready(function () {
      passReadyCallbacks = false;
    }); // (In the future we should use the event system for this, i.e. self.once('ready'))

    // Listen for widget changes
    self.on('changeWidget', function () {
      // Append all items to new widget
      for (var i = 0; i < children.length; i++) {
        self.widget.addItem(children[i]);
      }
    });

    /**
     * Add all items to list without appending to DOM.
     *
     * @public
     */
    var init = function () {
      var i;
      if (parameters !== undefined && parameters.length) {
        for (i = 0; i < parameters.length; i++) {
          addItem(i);
        }
      }
      else {
        if (field.defaultNum === undefined) {
          // Use min or 1 if no default item number is set.
          field.defaultNum = (field.min !== undefined ? field.min : 1);
        }
        // Add default number of fields.
        for (i = 0; i < field.defaultNum; i++) {
          addItem(i);
        }
      }
    };

    /**
     * Add item to list.
     *
     * @private
     * @param {Number} index
     * @param {*} [paramsOverride] Override params using this value.
     */
    var addItem = function (index, paramsOverride) {
      var childField = field.field;
      var widget = H5PEditor.getWidgetName(childField);

      if (parameters === undefined) {
        // Create new parameters for list
        parameters = [];
        setValue(field, parameters);
      }

      if (parameters[index] === undefined && childField['default'] !== undefined) {
        // Use default value
        parameters[index] = childField['default'];
      }
      if (paramsOverride !== undefined) {
        // Use override params
        parameters[index] = paramsOverride;
      }

      var child = children[index] = new H5PEditor.widgets[widget](self, childField, parameters[index], function (childField, value) {
        parameters[findIndex(child)] = value;
      });

      if (!passReadyCallbacks) {
        // Run collected ready callbacks
        for (var i = 0; i < readyCallbacks.length; i++) {
          readyCallbacks[i]();
        }
        readyCallbacks = []; // Reset
      }

      return child;
    };

    /**
     * Finds the index for the given child.
     *
     * @private
     * @param {Object} child field instance
     * @returns {Number} index
     */
    var findIndex = function (child) {
      for (var i = 0; i < children.length; i++) {
        if (children[i] === child) {
          return i;
        }
      }
    };

    /**
     * Get the singular form of the items added in the list.
     *
     * @public
     * @returns {String} The entity type
     */
    self.getEntity = function () {
      return (field.entity === undefined ? 'item' : field.entity);
    };

    /**
     * Adds a new list item and child field at the end of the list
     *
     * @public
     * @param {*} [paramsOverride] Override params using this value.
     * @returns {Boolean}
     */
    self.addItem = function (paramsOverride) {
      if (field.max === children.length) {
        return false;
      }

      var child = addItem(children.length, paramsOverride);
      self.widget.addItem(child);
      return true;
    };

    /**
     * Removes the list item at the given index.
     *
     * @public
     * @param {Number} index
     */
    self.removeItem = function (index) {
      // Remove child field
      children[index].remove();
      children.splice(index, 1);

      // Clean up parameters
      parameters.splice(index, 1);
      if (!parameters.length) {
        // Create new parameters for list
        parameters = undefined;
        setValue(field);
      }
    };

    /**
     * Removes all items.
     * This is useful if a widget wants to reset the list.
     *
     * @public
     */
    self.removeAllItems = function () {
      // Remove child fields
      for (var i = 0; i < children.length; i++) {
        children[i].remove();
      }
      children = [];

      // Clean up parameters
      parameters = undefined;
      setValue(field);
    };

    /**
     * Change the order of the items in the list.
     * Be aware that this may change the index of other existing items.
     *
     * @public
     * @param {Number} currentIndex
     * @param {Number} newIndex
     */
    self.moveItem = function (currentIndex, newIndex) {
      // Update child fields
      var child = children.splice(currentIndex, 1);
      children.splice(newIndex, 0, child[0]);

      // Update parameters
      var params = parameters.splice(currentIndex, 1);
      parameters.splice(newIndex, 0, params[0]);
    };

    /**
     * Allows ancestors and widgets to do stuff with our children.
     *
     * @public
     * @param {Function} task
     */
    self.forEachChild = function (task) {
      for (var i = 0; i < children.length; i++) {
        task(children[i]);
      }
    };

    /**
     * Collect callback to run when the editor is ready. If this item isn't
     * ready yet, jusy pass them on to the parent item.
     *
     * @public
     * @param {Function} ready
     */
    self.ready = function (ready) {
      if (passReadyCallbacks) {
        parent.ready(ready);
      }
      else {
        readyCallbacks.push(ready);
      }
    };

    /**
     * Make sure that this field and all child fields are valid.
     *
     * @public
     * @returns {Boolean}
     */
    self.validate = function () {
      var self = this;
      var valid = true;

      // Remove old error messages
      self.clearErrors();

      // Make sure child fields are valid
      for (var i = 0; i < children.length; i++) {
        if (children[i].validate() === false) {
          valid = false;
        }
      }

      // Validate our self
      if (field.max !== undefined && field.max > 0 &&
          parameters !== undefined && parameters.length > field.max) {
        // Invalid, more parameters than max allowed.
        valid = false;
        self.setError(H5PEditor.t('core', 'exceedsMax', {':property': label, ':max': field.max}));
      }
      if (field.min !== undefined && field.min > 0 &&
          (parameters === undefined || parameters.length < field.min)) {
        // Invalid, less parameters than min allowed.
        valid = false;
        self.setError(H5PEditor.t('core', 'exceedsMin', {':property': label, ':min': field.min}));
      }

      return valid;
    };

    // Start the party!
    init();
  }

  // Extends the semantics structure
  List.prototype = Object.create(H5PEditor.SemanticStructure.prototype);
  List.prototype.constructor = List;

  return List;
})(H5P.jQuery);

// Register widget
H5PEditor.widgets.list = H5PEditor.List;
