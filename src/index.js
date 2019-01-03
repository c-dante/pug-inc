import './index.css';

import { patch } from 'incremental-dom';
import { compile } from './pug-inc';

import todoTpl from './todo.tpl.pug';

const todoPatch = compile(todoTpl);

const defaultState = {
	items: [],
};

class PugTodoDemo extends HTMLElement {
	constructor() {
		super();
		console.debug(this);

		this._shadow = this.attachShadow({ mode: 'open' });
		this.props = {
			...defaultState,
			editItem: (evt) => {
				console.debug('Double click!', evt)
			},
			inputEventHandler: (evt) => {
				if (evt.code === 'Enter') {
					this.props = {
						...this.props,
						items: this.props.items.concat(evt.target.value)
					};

					evt.target.value = '';

					this.render(this.props);
				}
			}
		};

		this.render(this.props);
	}

	render(props = {}) {
		patch(this._shadow, todoPatch, props);
	}

	attributeChangedCallback(attr, oldVal, newVal) {
		this.render(this.props);
	}

	static get observedAttributes() {
		return ['data-items'];
	}
}

customElements.define('pug-todo-demo', PugTodoDemo);

